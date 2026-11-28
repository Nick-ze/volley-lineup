/**
 * v12.4: sharing a hosted tournament (docs/PLAN.md §56). Pure: the records a tournament is
 * synced as, the bookkeeping of local changes, the merge of what the server sends, and the
 * repair of a merged tournament. The engine is `src/lib/sync/tournament*.ts`.
 *
 * A shared tournament is a set of records `(kind, id)`: the tournament itself, its teams, their
 * players and its results. A record is replaced as a whole and the later save wins (the save
 * time, then the device id — the server's rule, `push_tournament_records`). The host writes
 * every kind; a guest ("scorer") writes results only.
 *
 * Not part of the `hostedTournament.ts` barrel (it pulls in the export schemas).
 */
import { z } from 'zod';

import {
  hostedPlayerSchema,
  hostedResultSchema,
  hostedTeamSchema,
  hostedTournamentSchema,
} from './exportFormat';
import { liveOk, playerOk, type HostedData } from './hostedData';
import { pairKey } from './hostedPlan';
import { resultValidity } from './hostedResult';
import { payloadHash, type RecordPayload } from './syncRecords';
import { normalizeTimestamp } from './syncSchema';
import type {
  HostedPlayer,
  HostedResult,
  HostedTeam,
  HostedTournament,
  SyncBase,
  SyncData,
  SyncEdit,
  SyncedTournament,
  TournamentRole,
} from './types';

export const HOSTED_RECORD_KINDS = ['tournament', 'team', 'player', 'result'] as const;
export type HostedRecordKind = (typeof HOSTED_RECORD_KINDS)[number];

/** The key of a record in the bookkeeping: `${kind}:${id}`. */
export const hostedKey = (kind: HostedRecordKind, id: string): string => `${kind}:${id}`;

export function parseHostedKey(key: string): { kind: HostedRecordKind; id: string } | null {
  const at = key.indexOf(':');
  const kind = key.slice(0, at) as HostedRecordKind;
  const id = key.slice(at + 1);
  return at > 0 && id !== '' && HOSTED_RECORD_KINDS.includes(kind) ? { kind, id } : null;
}

/** Whether a member with `role` may write records of `kind`. */
export const mayWrite = (role: TournamentRole, kind: HostedRecordKind): boolean =>
  role === 'host' || kind === 'result';

/** The shared tournaments of the sync state (none when the entry is missing). */
export const tournamentLinks = (sync: SyncData): Record<string, SyncedTournament> =>
  sync.tournaments ?? {};

/** `sync` with one tournament's bookkeeping replaced (`undefined`: not shared any more). */
export function withTournamentLink(
  sync: SyncData,
  tournamentId: string,
  link: SyncedTournament | undefined,
): SyncData {
  const { [tournamentId]: old, ...rest } = tournamentLinks(sync);
  if (old === link) return sync;
  return { ...sync, tournaments: link ? { ...rest, [tournamentId]: link } : rest };
}

/** `sync` without the links of tournaments that aren't on the device (any more). */
export function withoutGoneTournamentLinks(
  sync: SyncData,
  tournaments: readonly Pick<HostedTournament, 'id'>[],
): SyncData {
  const ids = new Set(tournaments.map((x) => x.id));
  const gone = Object.keys(tournamentLinks(sync)).filter((id) => !ids.has(id));
  return gone.reduce((s, id) => withTournamentLink(s, id, undefined), sync);
}

/* ---------------------------------------------------------------- a tournament's entities */

/** One tournament with everything that belongs to it. */
export interface TournamentSlice {
  tournament: HostedTournament;
  teams: HostedTeam[];
  players: HostedPlayer[];
  results: HostedResult[];
}

export function tournamentSlice(
  data: HostedData,
  tournamentId: string,
): TournamentSlice | undefined {
  const tournament = data.hostedTournaments.find((x) => x.id === tournamentId);
  if (!tournament) return undefined;
  const teams = data.hostedTeams.filter((x) => x.tournamentId === tournamentId);
  const teamIds = new Set(teams.map((x) => x.id));
  return {
    tournament,
    teams,
    players: data.hostedPlayers.filter((x) => teamIds.has(x.teamId)),
    results: data.hostedResults.filter((x) => x.tournamentId === tournamentId),
  };
}

/**
 * The data with the tournament's entities replaced by `slice` (`undefined`: removed). The
 * tournament keeps its place in the list; a new one goes to the end.
 */
export function replaceTournamentSlice(
  data: HostedData,
  tournamentId: string,
  slice: TournamentSlice | undefined,
): HostedData {
  const oldTeams = new Set(
    data.hostedTeams.filter((x) => x.tournamentId === tournamentId).map((x) => x.id),
  );
  const had = data.hostedTournaments.some((x) => x.id === tournamentId);
  const others = data.hostedTournaments.filter((x) => x.id !== tournamentId);
  const hostedTournaments = !slice
    ? others
    : had
      ? data.hostedTournaments.map((x) => (x.id === tournamentId ? slice.tournament : x))
      : [...others, slice.tournament];
  return {
    hostedTournaments,
    hostedTeams: [
      ...data.hostedTeams.filter((x) => x.tournamentId !== tournamentId),
      ...(slice?.teams ?? []),
    ],
    hostedPlayers: [
      ...data.hostedPlayers.filter((x) => !oldTeams.has(x.teamId)),
      ...(slice?.players ?? []),
    ],
    hostedResults: [
      ...data.hostedResults.filter((x) => x.tournamentId !== tournamentId),
      ...(slice?.results ?? []),
    ],
  };
}

/* ---------------------------------------------------------------- records */

const payloadSchemas: Record<HostedRecordKind, z.ZodType> = {
  tournament: hostedTournamentSchema.omit({ id: true, profileId: true }),
  team: hostedTeamSchema.omit({ id: true, tournamentId: true }),
  player: hostedPlayerSchema.omit({ id: true }),
  result: hostedResultSchema.omit({ id: true, tournamentId: true }),
};

/** The tournament as records: key → payload (the entity without what the key and place say). */
export function sliceRecords(slice: TournamentSlice): Map<string, RecordPayload> {
  const records = new Map<string, RecordPayload>();
  const { id, profileId: _profile, ...tournament } = slice.tournament;
  records.set(hostedKey('tournament', id), tournament);
  for (const { id: teamId, tournamentId: _t, ...team } of slice.teams)
    records.set(hostedKey('team', teamId), team);
  for (const { id: playerId, ...player } of slice.players)
    records.set(hostedKey('player', playerId), player);
  for (const { id: resultId, tournamentId: _t, ...result } of slice.results)
    records.set(hostedKey('result', resultId), result);
  return records;
}

/** Text order by code units: the same on every device, whatever its language. */
const compare = (a: string, b: string): number => Number(a > b) - Number(a < b);

/** Own matches by the time they were added (then by id); a round robin's results by id. */
const added = (result: HostedResult): string => result.addedAt ?? '';
const byAdded = (a: HostedResult, b: HostedResult): number =>
  compare(added(a), added(b)) || compare(a.id, b.id);

/**
 * The tournament the records describe, or `undefined` while its own record is missing. The
 * result is repaired (`repairSlice`), so it is always consistent data.
 */
export function recordsToSlice(
  records: ReadonlyMap<string, RecordPayload>,
  tournamentId: string,
  profileId: string,
): TournamentSlice | undefined {
  const own = records.get(hostedKey('tournament', tournamentId));
  if (!own) return undefined;
  const slice: TournamentSlice = {
    tournament: {
      ...(own as Omit<HostedTournament, 'id' | 'profileId'>),
      id: tournamentId,
      profileId,
    },
    teams: [],
    players: [],
    results: [],
  };
  for (const [key, payload] of records) {
    const parsed = parseHostedKey(key);
    if (!parsed || parsed.kind === 'tournament') continue;
    const { kind, id } = parsed;
    if (kind === 'team')
      slice.teams.push({
        ...(payload as Omit<HostedTeam, 'id' | 'tournamentId'>),
        id,
        tournamentId,
      });
    else if (kind === 'player')
      slice.players.push({ ...(payload as Omit<HostedPlayer, 'id'>), id });
    else
      slice.results.push({
        ...(payload as Omit<HostedResult, 'id' | 'tournamentId'>),
        id,
        tournamentId,
      });
  }
  slice.teams.sort((a, b) => a.order - b.order || compare(a.id, b.id));
  slice.players.sort((a, b) => compare(a.id, b.id));
  slice.results.sort(byAdded);
  return repairSlice(slice);
}

/**
 * A merged tournament made consistent (`isHostedConsistent`): what two devices saved apart can
 * contradict each other — a result for a team the host removed meanwhile, a rally that names a
 * deleted player, a fourth set after the host made it "best of 3". Every device repairs the same
 * way, so they end up with the same data:
 * - a player without a team (or without number and name) goes;
 * - a result whose teams aren't both there goes; of two results of one pair in a round robin the
 *   one with more sets stays (then the smaller id);
 * - sets that the format doesn't allow are cut off after the last valid set;
 * - live details that don't fit the sets, or name a player who isn't in the team, are dropped
 *   (the set scores stay);
 * - a round robin's result with nothing left goes.
 */
export function repairSlice(slice: TournamentSlice): TournamentSlice {
  const { tournament } = slice;
  const teamIds = new Set(slice.teams.map((x) => x.id));
  const players = slice.players.filter((p) => teamIds.has(p.teamId) && playerOk(p));
  const teamOfPlayer = new Map(players.map((p) => [p.id, p.teamId]));
  const manual = tournament.plan === 'manual';

  const fixed: HostedResult[] = [];
  for (const result of slice.results) {
    if (result.teamAId === result.teamBId) continue;
    if (!teamIds.has(result.teamAId) || !teamIds.has(result.teamBId)) continue;
    let next = result;
    if (next.sets.length > 0 && !resultValidity(next.sets, tournament).ok) {
      let keep = next.sets.length - 1;
      while (keep > 0 && !resultValidity(next.sets.slice(0, keep), tournament).ok) keep -= 1;
      const { live: _live, ...rest } = next;
      next = { ...rest, sets: next.sets.slice(0, keep) };
    }
    if (!liveOk(next, tournament, teamOfPlayer)) {
      const { live: _live, ...rest } = next;
      next = rest;
    }
    if (next.sets.length === 0 && next.live === undefined && !manual) continue;
    fixed.push(next);
  }

  let results = fixed;
  if (!manual) {
    const best = new Map<string, HostedResult>();
    for (const r of fixed) {
      const key = pairKey(r.teamAId, r.teamBId);
      const other = best.get(key);
      const better =
        !other ||
        r.sets.length > other.sets.length ||
        (r.sets.length === other.sets.length && r.id < other.id);
      if (better) best.set(key, r);
    }
    if (best.size < fixed.length) {
      const kept = new Set(best.values());
      results = fixed.filter((r) => kept.has(r));
    }
  }

  const same =
    players.length === slice.players.length &&
    results.length === slice.results.length &&
    results.every((r, i) => r === slice.results[i]);
  return same ? slice : { ...slice, players, results };
}

/* ---------------------------------------------------------------- rows from the server */

/** A record as pulled from the server (or returned by a push that wasn't applied). */
export interface HostedRemoteRecord {
  kind: HostedRecordKind;
  id: string;
  /** Null for a deletion (tombstone). */
  payload: RecordPayload | null;
  deleted: boolean;
  /** The (clamped) client save time: the last-write-wins key. ISO, millisecond precision. */
  at: string;
  /** The server's write time (for the pull cursor's overlap). */
  updatedAt: string;
  version: number;
  deviceId: string;
}

const time = z.string().transform((value, ctx) => {
  const normal = normalizeTimestamp(value);
  if (normal === null) ctx.addIssue({ code: 'custom', message: 'timestamp' });
  return normal ?? value;
});

const rowSchema = z.object({
  kind: z.enum(HOSTED_RECORD_KINDS),
  id: z.string().min(1).max(200),
  payload: z.unknown().optional(),
  deleted: z.boolean(),
  at: time,
  updated_at: time,
  version: z.number().int().positive(),
  device_id: z.string().nullable().optional(),
});

/**
 * A server row as a record, or null when it can't be used: a malformed row, a tombstone with a
 * payload, a payload that isn't the kind's shape, or a tombstone of the tournament itself (a
 * tournament is deleted for everyone by an RPC, never through a record).
 */
export function parseHostedRow(row: unknown): HostedRemoteRecord | null {
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
    const empty = parsed.data.payload === null || parsed.data.payload === undefined;
    return empty && kind !== 'tournament' ? { ...record, payload: null } : null;
  }
  const payload = payloadSchemas[kind].safeParse(parsed.data.payload);
  return payload.success ? { ...record, payload: payload.data as RecordPayload } : null;
}

/* ---------------------------------------------------------------- local changes */

const hashOf = (records: ReadonlyMap<string, RecordPayload>, key: string): string => {
  const payload = records.get(key);
  return payload === undefined ? '' : payloadHash(payload);
};

/** What the server has for a record, as far as this device knows: its hash, `''` for none. */
const baseHash = (base: SyncBase | undefined): string => (!base || base.del ? '' : base.h);

/**
 * The bookkeeping with every local change noted: a record whose content differs from what the
 * server has gets an edit with the time `now` (an edit of the same content keeps its time), and
 * an edit that no longer differs is forgotten. A scorer's changes to anything but results are
 * not noted (they can't be saved; the next change from the server replaces them). The same
 * object when nothing changes.
 */
export function noteHostedEdits(
  link: SyncedTournament,
  records: ReadonlyMap<string, RecordPayload>,
  now: string,
): SyncedTournament {
  const edits: Record<string, SyncEdit> = {};
  let changed = false;
  const keys = new Set([...records.keys(), ...Object.keys(link.base), ...Object.keys(link.edits)]);
  for (const key of keys) {
    const parsed = parseHostedKey(key);
    const old = link.edits[key];
    const h = hashOf(records, key);
    const differs =
      parsed !== null && mayWrite(link.role, parsed.kind) && h !== baseHash(link.base[key]);
    if (!differs) {
      if (old) changed = true;
      continue;
    }
    if (old && old.h === h) edits[key] = old;
    else {
      edits[key] = { at: now, h };
      changed = true;
    }
  }
  return changed ? { ...link, edits } : link;
}

/** How many local changes wait for the server. */
export const pendingHostedCount = (link: SyncedTournament): number =>
  Object.keys(link.edits).length;

/* ---------------------------------------------------------------- merge */

/** `(at, device)` of a local edit is later than a server row's: the server's own rule. */
const laterThan = (edit: SyncEdit, deviceId: string, row: HostedRemoteRecord): boolean =>
  edit.at > row.at || (edit.at === row.at && deviceId > row.deviceId);

export interface HostedMerge {
  link: SyncedTournament;
  records: Map<string, RecordPayload>;
  /** Whether a record's content changed on this device. */
  changed: boolean;
}

/**
 * Rows from the server merged into the tournament's records. A row this device already knows
 * (by its version) is skipped. Where the device has an unsent change of the record, the later
 * save wins; a change that loses is gone, one that wins stays and is pushed. Everywhere else
 * the row replaces the record.
 */
export function mergeHostedRows(
  link: SyncedTournament,
  local: ReadonlyMap<string, RecordPayload>,
  rows: readonly HostedRemoteRecord[],
  deviceId: string,
): HostedMerge {
  const records = new Map(local);
  const base = { ...link.base };
  const edits = { ...link.edits };
  let changed = false;
  let touched = false;
  for (const row of [...rows].sort((a, b) => a.version - b.version)) {
    const key = hostedKey(row.kind, row.id);
    const known = base[key];
    if (known && row.version <= known.v) continue;
    touched = true;
    const h = row.payload === null ? '' : payloadHash(row.payload);
    base[key] = { v: row.version, h, at: row.at, ...(row.deleted ? { del: true as const } : {}) };
    const edit = edits[key];
    if (edit && edit.h !== h && mayWrite(link.role, row.kind) && laterThan(edit, deviceId, row))
      continue; // this device's change is the later save: it stays and is pushed
    delete edits[key];
    if (hashOf(records, key) === h) continue;
    if (row.payload === null) records.delete(key);
    else records.set(key, row.payload);
    changed = true;
  }
  return { link: touched ? { ...link, base, edits } : link, records, changed };
}

/* ---------------------------------------------------------------- push */

/** One record to push: its content now (null: deleted) with the time of its change. */
export interface HostedPush {
  key: string;
  kind: HostedRecordKind;
  id: string;
  at: string;
  hash: string;
  payload: RecordPayload | null;
}

/** At most this many records in one push (the server takes 200 and 1 MB). */
export const HOSTED_PUSH_LIMIT = 100;

/**
 * The local changes to push, parents first (the tournament, teams, players, results), at most
 * `limit`. A change the member may not save is left out.
 */
export function hostedPushItems(
  link: SyncedTournament,
  records: ReadonlyMap<string, RecordPayload>,
  limit: number = HOSTED_PUSH_LIMIT,
): HostedPush[] {
  const items: HostedPush[] = [];
  for (const [key, edit] of Object.entries(link.edits)) {
    const parsed = parseHostedKey(key);
    if (!parsed || !mayWrite(link.role, parsed.kind)) continue;
    const payload = records.get(key) ?? null;
    const hash = payload === null ? '' : payloadHash(payload);
    if (hash === baseHash(link.base[key])) continue;
    // The tournament's own record is never deleted through a record.
    if (payload === null && parsed.kind === 'tournament') continue;
    items.push({ key, kind: parsed.kind, id: parsed.id, at: edit.at, hash, payload });
  }
  const rank = (kind: HostedRecordKind) => HOSTED_RECORD_KINDS.indexOf(kind);
  return items.sort((a, b) => rank(a.kind) - rank(b.kind) || compare(a.key, b.key)).slice(0, limit);
}

/** A push's result per record, as `push_tournament_records` returns it. */
export interface HostedPushOutcome {
  kind: HostedRecordKind;
  id: string;
  applied: boolean;
  version: number;
  at: string;
  updatedAt: string;
  deleted: boolean;
  /** The server's content when the push wasn't applied (null for a tombstone). */
  payload?: RecordPayload | null;
  deviceId?: string;
}

/**
 * The bookkeeping after a push. An applied record gets its new base and loses its edit (unless
 * it was changed again meanwhile). A record the server kept a later save of comes back as a
 * `stale` row for `mergeHostedRows` — unless this device already knew that save: then the change
 * was made on top of it, and its time moves to just after it so the next push wins.
 */
export function applyHostedPush(
  link: SyncedTournament,
  pushed: readonly HostedPush[],
  outcomes: readonly HostedPushOutcome[],
): { link: SyncedTournament; stale: HostedRemoteRecord[] } {
  const byKey = new Map(pushed.map((item) => [item.key, item]));
  const base = { ...link.base };
  const edits = { ...link.edits };
  const stale: HostedRemoteRecord[] = [];
  for (const r of outcomes) {
    const key = hostedKey(r.kind, r.id);
    const known = base[key];
    const edit = edits[key];
    if (!r.applied) {
      if (edit && known && r.version <= known.v) {
        const after = Date.parse(r.at) + 1;
        if (Number.isFinite(after) && Date.parse(edit.at) < after)
          edits[key] = { ...edit, at: new Date(after).toISOString() };
        continue;
      }
      stale.push({
        kind: r.kind,
        id: r.id,
        payload: r.deleted ? null : (r.payload ?? null),
        deleted: r.deleted,
        at: r.at,
        updatedAt: r.updatedAt,
        version: r.version,
        deviceId: r.deviceId ?? '',
      });
      continue;
    }
    const item = byKey.get(key);
    if (!item) continue;
    base[key] = {
      v: r.version,
      h: item.hash,
      at: r.at,
      ...(item.payload === null ? { del: true as const } : {}),
    };
    if (edit?.h === item.hash) delete edits[key];
  }
  return { link: { ...link, base, edits }, stale };
}

/* ---------------------------------------------------------------- linking */

/**
 * The bookkeeping of a tournament the host shares now: every record is a change of `now`, so
 * the first push uploads all of it.
 */
export function newHostLink(
  userId: string,
  records: ReadonlyMap<string, RecordPayload>,
  now: string,
): SyncedTournament {
  return noteHostedEdits({ userId, role: 'host', cursor: 0, base: {}, edits: {} }, records, now);
}

/** The bookkeeping of a tournament that is about to be downloaded (nothing known yet). */
export const emptyLink = (userId: string, role: TournamentRole): SyncedTournament => ({
  userId,
  role,
  cursor: 0,
  base: {},
  edits: {},
});

/**
 * An import must not write over a shared tournament (its content would be pushed over the
 * cloud's as changes made now): the incoming data with every tournament in `linked` taken from
 * the device as it is — or left out when it isn't on the device.
 */
export function keepLinkedTournaments(
  current: HostedData,
  incoming: HostedData,
  linked: readonly string[],
): HostedData {
  return linked.reduce(
    (data, id) => replaceTournamentSlice(data, id, tournamentSlice(current, id)),
    incoming,
  );
}
