/**
 * v10: validation of records pulled from the server (docs/V10_SYNC_DESIGN.md §3.1, §3.5). Pure.
 *
 * Remote data is untrusted: every row is checked (shape, kind, id, timestamps) and its payload
 * is validated against the export file's entity schemas minus the fields that aren't in a
 * payload. Unknown payload fields are dropped. Invalid rows are skipped by the caller. Text
 * fields have sane length limits here (sync only, the export file is unchanged): names 200
 * characters, any other text 1000.
 *
 * Forward-compatibility limit: because unknown fields are dropped, fields a newer app version
 * adds to a record are lost when an older app version edits and pushes that record.
 *
 * Rows this version refuses are skipped, and once a team's pull cursor has passed them they are
 * not pulled again (v10 audit L6). So an app version that accepts more than the one before it
 * (a new field or kind, a longer text) MUST come with a new store version: the store migration
 * then resets the pull cursors (`withPullCursorsReset`, `src/store/migrations.ts`) and every
 * shared team is pulled once more from the start.
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
import type { SyncData } from './types';

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
  return textFits(value, '') ? value : null;
}

const NAME_FIELDS: ReadonlySet<string> = new Set(['firstName', 'lastName', 'name', 'opponent']);
export const MAX_NAME_LENGTH = 200;
export const MAX_TEXT_LENGTH = 1000;

/** True when every string in the value is short enough (names ≤ 200, other text ≤ 1000). */
export function textFits(value: unknown, field = ''): boolean {
  if (typeof value === 'string') {
    return value.length <= (NAME_FIELDS.has(field) ? MAX_NAME_LENGTH : MAX_TEXT_LENGTH);
  }
  if (Array.isArray(value)) return value.every((x) => textFits(x, field));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).every(([k, v]) => textFits(v, k));
  }
  return true;
}

/**
 * True when no text in the value has half of a character pair (a lone surrogate: what is left
 * of an emoji that was cut in the middle). The database can't store such a text — it refuses
 * the whole request (PostgreSQL's jsonb, SQLSTATE 22P02).
 */
export function textIsWhole(value: unknown): boolean {
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i += 1) {
      const unit = value.charCodeAt(i);
      if (unit < 0xd800 || unit > 0xdfff) continue;
      const next = value.charCodeAt(i + 1);
      if (unit > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff)) return false;
      i += 1;
    }
    return true;
  }
  if (Array.isArray(value)) return value.every(textIsWhole);
  if (value !== null && typeof value === 'object') return Object.values(value).every(textIsWhole);
  return true;
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

/* ---------------------------------------------------------------- the stored `sync` slice */

const storedSyncTeam = z.looseObject({
  userId: z.string(),
  role: z.enum(['manager', 'player']),
  cursor: z.number(),
  base: z.record(z.string(), z.looseObject({ v: z.number(), h: z.string(), at: z.string() })),
  edits: z.record(z.string(), z.looseObject({ at: z.string(), h: z.string() })),
  photos: z.array(z.string()),
});

const storedSync = z.looseObject({
  deviceId: z.string().nullable(),
  account: z
    .looseObject({ userId: z.string(), email: z.string(), profileId: z.string() })
    .nullable(),
  teams: z.record(z.string(), storedSyncTeam),
});

/**
 * The stored `sync` slice as loaded, or the empty slice when it is malformed (v10 audit L32: a
 * `null` slice or one without `teams` made the Teams tab and "Delete all data" throw). A valid
 * slice is returned as it is, so fields a newer app version added are kept. A malformed one keeps
 * only a valid device id; its links are lost, the teams stay on the device as local teams.
 */
export function storedSyncData(value: unknown): SyncData {
  if (storedSync.safeParse(value).success) return value as SyncData;
  const deviceId =
    typeof value === 'object' && value !== null && 'deviceId' in value
      ? (value as { deviceId: unknown }).deviceId
      : null;
  return { deviceId: typeof deviceId === 'string' ? deviceId : null, account: null, teams: {} };
}

/**
 * A pull cursor below every server version: the next pull reads the whole team again and merges
 * it the normal way. Unlike 0 it doesn't mark a view-only copy for replacement by the cloud's
 * (`needsReset`: a viewer with cursor 0 and a `base`).
 */
export const REPULL_CURSOR = -1;

/**
 * The `sync` slice with the pull cursor of every shared team that has pulled before set to
 * `REPULL_CURSOR` (v10 audit L6): the next pull reads the whole team again, so rows an older app
 * version couldn't read arrive. Records the device already has are skipped by their version
 * (`base`), everything else is merged as on any pull — on a view-only device too: a reset pull
 * there would delete its copies of records whose newest row it still can't read, skip what
 * changed meanwhile when the team's own row is such a row, and strip references a later row
 * brings back (found by the review of this fix). A cursor at 0 stays 0: nothing was pulled yet,
 * or a reset pull is still to come. The same object when nothing changes.
 */
export function withPullCursorsReset(sync: SyncData): SyncData {
  const teams = Object.entries(sync.teams);
  if (teams.every(([, team]) => team.cursor <= 0)) return sync;
  return {
    ...sync,
    teams: Object.fromEntries(
      teams.map(([id, team]) => [id, team.cursor > 0 ? { ...team, cursor: REPULL_CURSOR } : team]),
    ),
  };
}
