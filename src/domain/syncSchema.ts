/**
 * v10: validation of records pulled from the server (docs/V10_SYNC_DESIGN.md §3.1, §3.5). Pure.
 *
 * Remote data is untrusted: every row is checked (shape, kind, id, timestamps) and its payload
 * is validated against the export file's entity schemas minus the fields that aren't in a
 * payload. Unknown payload fields are dropped. Invalid rows are skipped by the caller.
 */
import { z } from 'zod';

import {
  matchSchema,
  opponentSchema,
  playerSchema,
  presetSchema,
  seasonSchema,
  setLineupSchema,
  teamSchema,
} from './exportFormat';
import { parseSetRecordId, RECORD_KINDS, type RecordKind, type RecordPayload } from './syncRecords';

/** A record as pulled from the server (or returned by a push that wasn't applied). */
export interface RemoteRecord {
  kind: RecordKind;
  id: string;
  /** Null for a deletion (tombstone). */
  payload: RecordPayload | null;
  deleted: boolean;
  /** The (clamped) client save time: the last-write-wins key. ISO, millisecond precision. */
  at: string;
  /** The server's write time (for the pull cursor's overlap). ISO, millisecond precision. */
  updatedAt: string;
  /** The server's sequence number of the write. */
  version: number;
  deviceId: string;
}

const payloadSchemas: Record<RecordKind, z.ZodType> = {
  team: teamSchema.omit({ id: true, profileId: true }),
  player: playerSchema.omit({ id: true, teamId: true, description: true }),
  season: seasonSchema.omit({ id: true, teamId: true }),
  opponent: opponentSchema.omit({ id: true }),
  match: matchSchema.omit({ id: true, teamId: true, sets: true }),
  set: setLineupSchema,
  preset: presetSchema.omit({ id: true, teamId: true }).extend({ kind: z.literal('preset') }),
  starters: presetSchema
    .omit({ id: true, teamId: true, kind: true })
    .extend({ presetId: z.string().min(1) }),
};

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * A timestamp (ISO 8601 or Postgres `timestamptz` JSON, any fraction) as a canonical ISO string
 * in UTC with milliseconds, or null when it isn't one.
 */
export function normalizeTimestamp(value: string): string | null {
  const m = TIMESTAMP.exec(value);
  if (!m) return null;
  const ms = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
  const zone = m[4] === 'Z' ? 'Z' : `${m[4].slice(0, 3)}:${m[4].slice(3).replace(':', '') || '00'}`;
  const time = Date.parse(`${m[1]}T${m[2]}.${ms}${zone}`);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * The payload validated for its kind and id (null when invalid): a set's id must be
 * `<matchId>/<n>` with `setNumber` n. Unknown fields are dropped.
 */
export function parsePayload(kind: RecordKind, id: string, payload: unknown): RecordPayload | null {
  const result = payloadSchemas[kind].safeParse(payload);
  if (!result.success) return null;
  const value = result.data as RecordPayload;
  if (kind === 'set' && parseSetRecordId(id)?.setNumber !== value.setNumber) return null;
  return value;
}

const timestamp = z.string().transform((value, ctx) => {
  const iso = normalizeTimestamp(value);
  if (iso === null) {
    ctx.addIssue({ code: 'custom', message: 'timestamp' });
    return z.NEVER;
  }
  return iso;
});

const rowSchema = z.object({
  kind: z.enum(RECORD_KINDS),
  id: z.string().min(1).max(200),
  payload: z.unknown(),
  deleted: z.boolean(),
  at: timestamp,
  updated_at: timestamp,
  version: z.number().int().nonnegative(),
  device_id: z.string().max(64).optional(),
});

/**
 * A row of `pull_changes` (`{kind, id, payload, deleted, at, updated_at, version, device_id}`)
 * as a `RemoteRecord`, or null when anything about it is invalid: unknown kind, bad id or
 * timestamps, a tombstone with a payload, a payload that fails its schema, or a team tombstone
 * (teams are deleted for everyone by an RPC, never through a record).
 */
export function parseRemoteRow(row: unknown): RemoteRecord | null {
  const parsed = rowSchema.safeParse(row);
  if (!parsed.success) return null;
  const { kind, id, deleted, at, updated_at, version, device_id } = parsed.data;
  const record = {
    kind,
    id,
    deleted,
    at,
    updatedAt: updated_at,
    version,
    deviceId: device_id ?? '',
  };
  if (deleted) {
    return parsed.data.payload === null && kind !== 'team' ? { ...record, payload: null } : null;
  }
  const payload = parsePayload(kind, id, parsed.data.payload);
  return payload === null ? null : { ...record, payload };
}
