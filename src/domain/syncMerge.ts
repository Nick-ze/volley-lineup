/**
 * v10: applying what the server has to a team on the device (docs/V10_SYNC_DESIGN.md §3.4,
 * §3.5, §3.9, §3.13). Pure.
 *
 * Per record, the most recent save wins: a record the device hasn't changed takes the server's
 * content; a changed one keeps its change when it was saved later than the server's. Deleting a
 * season, opponent, match or player that something newer still needs brings it back instead
 * (and the device pushes it again); otherwise the deletion cascades on the device. Afterwards
 * `repairSlice` keeps the team consistent — except that it never removes a player only this
 * device lacks (played sets and other references keep them; see `repairSlice`'s `keep`).
 *
 * For the engine (docs/V10_SYNC_DESIGN.md §3.5):
 * - Store the `edits` of `detectChanges` before every merge: an unnoted change loses to any row.
 * - Merge all pages of one pull at once. Page with the raw rows' versions (also of rows that
 *   fail `parseRemoteRow`); compute `nextCursor` from the parsed rows and don't advance the
 *   cursor while `MergeOutput.slice` is undefined (the team row hasn't arrived).
 * - Don't push a team in a cycle whose merge skipped a row as `foreignId`: its records name ids
 *   another local team uses, and the device's copy isn't the server's.
 * - After a demotion use `resetToCloudMerge` with a complete pull from version 0.
 */
import {
  inPlayedSet,
  descendants,
  parentKey,
  parentPresent,
  playerReferences,
  type Records,
} from './syncGraph';
import { referencedPlayerIds, repairSlice, type RepairIssue } from './syncRepair';
import { normalizeTimestamp, parsePayload, type RemoteRecord } from './syncSchema';
import {
  payloadHash,
  RECORD_KINDS,
  recordKey,
  recordsToSlice,
  sliceToRecords,
  type RecordKind,
  type RecordPayload,
  type TeamSlice,
} from './syncRecords';
import type { LocalChange } from './syncChanges';
import type { SyncBase, SyncEdit, SyncedTeam } from './types';

export interface MergeInput {
  /** The team's id (needed when the team isn't on the device yet). */
  teamId: string;
  /** The team on the device (undefined: a download). */
  slice: TeamSlice | undefined;
  team: SyncedTeam;
  /** All rows of one pull (every page), or the stale results of a push. */
  rows: readonly RemoteRecord[];
  /** The profile a downloaded team goes to. */
  local: { profileId: string };
  /** Entity keys used by the device's other teams (`foreignKeys`). */
  foreignIds: ReadonlySet<string>;
}

export type SkipReason = 'foreignId' | 'orphan' | 'invalid';

export interface MergeOutput {
  /** The merged, repaired team (the same object when nothing changed; undefined: no team). */
  slice: TeamSlice | undefined;
  /** The team's sync state with the new `base` and `edits` (the cursor is the caller's). */
  team: SyncedTeam;
  skipped: { key: string; reason: SkipReason }[];
  /** What `repairSlice` did (e.g. duplicate jersey numbers to warn about). */
  issues: RepairIssue[];
}

const time = (iso: string | undefined): number =>
  iso === undefined ? Number.NEGATIVE_INFINITY : Date.parse(iso);

const kindOrder = (kind: RecordKind) => RECORD_KINDS.indexOf(kind);

/** Deletions are resolved parents first, players after the sets that may still need them. */
const DELETE_ORDER: readonly RecordKind[] = [
  'season',
  'opponent',
  'match',
  'set',
  'player',
  'preset',
  'starters',
];

/** One row per key (the highest version), parents before children. */
function sortRows(rows: readonly RemoteRecord[]): RemoteRecord[] {
  const latest = new Map<string, RemoteRecord>();
  for (const row of rows) {
    const key = recordKey(row.kind, row.id);
    const seen = latest.get(key);
    if (!seen || seen.version < row.version) latest.set(key, row);
  }
  return [...latest.values()].sort(
    (a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.version - b.version,
  );
}

/** The validated payload, `null` for a valid tombstone, `undefined` when the row is invalid. */
function validPayload(row: RemoteRecord, teamId: string): RecordPayload | null | undefined {
  if ((row.kind === 'team' || row.kind === 'starters') && row.id !== teamId) return undefined;
  if (row.deleted) return row.payload === null && row.kind !== 'team' ? null : undefined;
  return parsePayload(row.kind, row.id, row.payload) ?? undefined;
}

/** The key ids are unique against: another team's entity, or a clash of preset and starters. */
function isForeign(
  row: RemoteRecord,
  payload: RecordPayload | null,
  records: Records,
  teamId: string,
  foreignIds: ReadonlySet<string>,
): boolean {
  if (row.kind === 'team') return false;
  if (row.kind === 'set') {
    return foreignIds.has(recordKey('match', row.id.slice(0, row.id.lastIndexOf('/'))));
  }
  if (row.kind === 'starters') {
    if (payload === null) return false;
    const presetKey = recordKey('preset', String(payload.presetId));
    return foreignIds.has(presetKey) || records.has(presetKey);
  }
  if (row.kind === 'preset' && records.get(recordKey('starters', teamId))?.presetId === row.id) {
    return true;
  }
  return foreignIds.has(recordKey(row.kind, row.id));
}

interface Prior {
  row: RemoteRecord;
  payload: RecordPayload | undefined;
  base: SyncBase | undefined;
  edit: SyncEdit | undefined;
  reverted?: boolean;
}

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

function sameSlice(a: TeamSlice | undefined, b: TeamSlice): boolean {
  return (
    a !== undefined &&
    a.team === b.team &&
    sameItems(a.players, b.players) &&
    sameItems(a.seasons, b.seasons) &&
    sameItems(a.opponents, b.opponents) &&
    sameItems(a.matches, b.matches) &&
    sameItems(a.presets, b.presets)
  );
}

function sameEntries<V>(a: Readonly<Record<string, V>>, b: Readonly<Record<string, V>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

/**
 * The team after applying pulled rows (see the module comment). Rows already known (version ≤
 * `base[key].v`) are skipped; invalid rows, rows whose id belongs to another local team and
 * rows whose parent isn't there are skipped and reported (they get no `base`). Device-only
 * fields (the team's profile, players' descriptions) are kept.
 */
export function mergeRemote(input: MergeInput): MergeOutput {
  return merge(input, false);
}

/**
 * After a demotion (`resetToCloud`: cursor 0, no edits): the server's content replaces every
 * local change, nothing is resurrected, and local records the server doesn't have are dropped.
 * `input.rows` MUST be the complete pull from version 0 (every page): records missing from it
 * are deleted. Without the team's row among them it does nothing (returns the input as it was).
 */
export function resetToCloudMerge(input: MergeInput): MergeOutput {
  const hasTeam = input.rows.some((r) => r.kind === 'team' && r.id === input.teamId);
  if (!hasTeam) return { slice: input.slice, team: input.team, skipped: [], issues: [] };
  return merge(input, true);
}

function merge(input: MergeInput, cloudWins: boolean): MergeOutput {
  const { teamId, team, foreignIds } = input;
  const records = new Map(input.slice ? sliceToRecords(input.slice) : []);
  const base: Record<string, SyncBase> = { ...team.base };
  const edits: Record<string, SyncEdit> = { ...team.edits };
  const skipped: MergeOutput['skipped'] = [];
  const upserted = new Map<string, Prior>();
  const pending = new Set<string>();
  /** Players the cloud has that a reset pull can't apply here: their references stay. */
  const unreadable = new Set<string>();
  const rows = sortRows(input.rows);

  for (const row of rows) {
    const key = recordKey(row.kind, row.id);
    const known = base[key];
    if (!cloudWins && known && row.version <= known.v) continue;
    const payload = validPayload(row, teamId);
    if (payload === undefined || isForeign(row, payload, records, teamId, foreignIds)) {
      skipped.push({ key, reason: payload === undefined ? 'invalid' : 'foreignId' });
      if (cloudWins) {
        base[key] = unapplied(row, records.get(key));
        if (row.kind === 'player') unreadable.add(row.id);
      }
      continue;
    }
    const local = records.get(key);
    const dirty = !cloudWins && (known ? (local ? payloadHash(local) : '') !== known.h : !!local);
    const edit = edits[key];
    const remoteWins = !dirty || edit === undefined || time(row.at) >= time(edit.at);
    base[key] = {
      v: row.version,
      h: payload === null ? '' : payloadHash(payload),
      at: row.at,
      ...(payload === null ? { del: true as const } : {}),
    };
    if (!remoteWins) continue;
    delete edits[key];
    if (payload === null) {
      if (local) pending.add(key);
    } else {
      upserted.set(key, { row, payload: local, base: known, edit });
      records.set(key, payload);
    }
  }

  const cloudKeys = new Set(cloudWins ? rows.map((r) => recordKey(r.kind, r.id)) : []);
  if (cloudWins) {
    for (const key of [...records.keys()]) {
      if (cloudKeys.has(key) || key === recordKey('team', teamId)) continue;
      records.delete(key);
      delete edits[key];
    }
  }

  const removed = resolveDeletions(records, pending, base, edits, cloudWins);
  pruneOrphans(records, teamId, upserted, base, edits, skipped, cloudWins);
  if (cloudWins) settleBase(records, base, cloudKeys);

  const nextTeam =
    sameEntries(base, team.base) && sameEntries(edits, team.edits)
      ? team
      : { ...team, base, edits };
  if (!records.has(recordKey('team', teamId))) {
    return { slice: input.slice, team: nextTeam, skipped, issues: [] };
  }
  const descriptions = new Map<string, string>();
  for (const p of input.slice?.players ?? []) {
    if (p.description !== undefined) descriptions.set(p.id, p.description);
  }
  const built = recordsToSlice(teamId, records, {
    profileId: input.local.profileId,
    descriptions,
    previous: input.slice,
  });
  // Missing players keep their references unless this merge deleted them (a pending local
  // delete, an id skipped as foreign, a player deleted before a newer reference arrived).
  const present = new Set(built.players.map((p) => p.id));
  const keep = new Set(
    cloudWins
      ? [...unreadable].filter((id) => !present.has(id))
      : [...referencedPlayerIds(built)].filter((id) => !present.has(id) && !removed.has(id)),
  );
  const repaired = repairSlice(built, keep);
  const slice = sameSlice(input.slice, repaired.slice) ? input.slice : repaired.slice;
  return { slice, team: nextTeam, skipped, issues: repaired.issues };
}

/**
 * `base` for a row a reset pull can't apply on this device (it is invalid here, or its id
 * belongs to another local team): the device's own state at the row's version, so nothing is
 * pushed for it — neither the local record as a change nor its absence as a deletion.
 */
function unapplied(row: RemoteRecord, local: RecordPayload | undefined): SyncBase {
  return local
    ? { v: row.version, h: payloadHash(local), at: row.at }
    : { v: row.version, h: '', at: row.at, del: true };
}

/**
 * After a reset pull `base` must describe exactly what the device has, or the first change
 * detection as a manager (a promotion, audit H8) would push the difference: an entry the pull
 * didn't confirm goes (the cloud never had that record), and an entry whose record isn't on
 * the device (an orphan the cloud still has) counts as deleted here — no tombstone is pushed.
 */
function settleBase(
  records: ReadonlyMap<string, RecordPayload>,
  base: Record<string, SyncBase>,
  cloudKeys: ReadonlySet<string>,
): void {
  for (const key of Object.keys(base)) {
    if (!cloudKeys.has(key)) delete base[key];
    else if (!records.has(key) && !base[key].del) base[key] = { ...base[key], h: '', del: true };
  }
}

/** The latest save time the device knows for a record (+∞ for a new, unseen local record). */
function savedAt(key: string, base: Record<string, SyncBase>, edits: Record<string, SyncEdit>) {
  if (!base[key] && !edits[key]) return Number.POSITIVE_INFINITY;
  return Math.max(time(base[key]?.at), time(edits[key]?.at));
}

/**
 * Tombstones that won: a parent that something newer still needs stays (resurrected — its
 * `base` is the tombstone, so a manager pushes it again, together with what stays below it); a
 * set stays while its match does (sets only go with their match); else the record goes and so
 * does everything below it, without `base` or `edits` (no tombstones are pushed for them).
 */
function resolveDeletions(
  records: Map<string, RecordPayload>,
  pending: Set<string>,
  base: Record<string, SyncBase>,
  edits: Record<string, SyncEdit>,
  cloudWins: boolean,
): Set<string> {
  const removedPlayers = new Set<string>();
  const order = (key: string) => DELETE_ORDER.indexOf(key.slice(0, key.indexOf(':')) as RecordKind);
  const repush = new Set<string>();
  for (const key of [...pending].sort((a, b) => order(a) - order(b))) {
    if (!pending.delete(key)) continue; // already gone with its parent
    const kind = key.slice(0, key.indexOf(':')) as RecordKind;
    const id = key.slice(key.indexOf(':') + 1);
    const deletedAt = time(base[key].at);
    const newer = (child: string) => !pending.has(child) && savedAt(child, base, edits) > deletedAt;
    const below =
      kind === 'set' || kind === 'player' || kind === 'preset' || kind === 'starters'
        ? []
        : descendants(records, key);
    const stays =
      !cloudWins &&
      (kind === 'set'
        ? records.has(recordKey('match', id.slice(0, id.lastIndexOf('/'))))
        : kind === 'player'
          ? inPlayedSet(records, id) || playerReferences(records, id).some(newer)
          : below.some(newer));
    if (stays) {
      for (const child of below) if (!pending.has(child)) repush.add(child);
      continue;
    }
    records.delete(key);
    if (kind === 'player') removedPlayers.add(id);
    for (const child of below) {
      records.delete(child);
      delete base[child];
      delete edits[child];
      pending.delete(child);
    }
  }
  // Devices that already let the subtree go get it back: what stays below is pushed again.
  for (const key of repush) delete base[key];
  return removedPlayers;
}

/**
 * Pulled records whose parent isn't there are not applied: the device keeps what it had and no
 * `base` (repeated until nothing changes, since a match without sets is an orphan too). When the
 * device doesn't have the record and deleted its parent itself, the row counts as deleted
 * (`base` a tombstone, the device's own deletion forgotten), so the device doesn't push that
 * deletion again every cycle. With 'cloudWins', local records without a parent go as well.
 */
function pruneOrphans(
  records: Map<string, RecordPayload>,
  teamId: string,
  upserted: Map<string, Prior>,
  base: Record<string, SyncBase>,
  edits: Record<string, SyncEdit>,
  skipped: MergeOutput['skipped'],
  cloudWins: boolean,
): void {
  for (let again = true; again;) {
    again = false;
    for (const [key, payload] of [...records]) {
      if (parentPresent(records, teamId, key, payload)) continue;
      const prior = upserted.get(key);
      if (prior && !prior.reverted) {
        prior.reverted = true;
        const parent = parentKey(teamId, key, payload) as string;
        if (prior.payload) records.set(key, prior.payload);
        else records.delete(key);
        if (!prior.payload && (base[parent]?.del || edits[parent]?.h === '')) {
          base[key] = { v: prior.row.version, h: '', at: prior.row.at, del: true };
          delete edits[key];
        } else {
          if (prior.base) base[key] = prior.base;
          else delete base[key];
          if (prior.edit) edits[key] = prior.edit;
        }
        skipped.push({ key, reason: 'orphan' });
        again = true;
      } else if (cloudWins) {
        records.delete(key);
        again = true;
      }
    }
  }
}

/** A push's result per record, as `push_records` returns it. */
export interface PushOutcome {
  kind: RecordKind;
  id: string;
  applied: boolean;
  version: number;
  at: string;
  updatedAt: string;
  deleted: boolean;
  /** The server's content when the push wasn't applied (null for a tombstone). */
  payload?: RecordPayload | null;
  /** The device that saved the server's content (when the push wasn't applied). */
  deviceId?: string;
}

/**
 * The team's sync state after a push: applied records get their new `base` (and lose their
 * edit unless the user changed them again meanwhile); records the server kept a newer save of
 * come back as `stale` rows for `mergeRemote` — unless the device already knew that save
 * (version ≤ `base`): then the change was made on top of it and is re-stamped just after it,
 * so the next push wins instead of being refused forever.
 */
export function applyPushResults(
  team: SyncedTeam,
  pushed: readonly LocalChange[],
  results: readonly PushOutcome[],
): { team: SyncedTeam; stale: RemoteRecord[] } {
  const byKey = new Map(pushed.map((c) => [c.key, c]));
  const base: Record<string, SyncBase> = { ...team.base };
  const edits: Record<string, SyncEdit> = { ...team.edits };
  const stale: RemoteRecord[] = [];
  for (const r of results) {
    const key = recordKey(r.kind, r.id);
    const at = normalizeTimestamp(r.at) ?? r.at;
    const known = base[key];
    const edit = edits[key];
    if (!r.applied && edit && known && r.version <= known.v) {
      // The server kept a save this device already had (its own earlier one: the clock went
      // back, or two saves in one millisecond). The change was made on top of it, so it is
      // newer: its time moves to just after the server's and it is pushed again.
      const after = time(at) + 1;
      if (Number.isFinite(after) && time(edit.at) < after)
        edits[key] = { ...edit, at: new Date(after).toISOString() };
      continue;
    }
    if (!r.applied) {
      stale.push({
        kind: r.kind,
        id: r.id,
        payload: r.payload ?? null,
        deleted: r.deleted,
        at,
        updatedAt: normalizeTimestamp(r.updatedAt) ?? r.updatedAt,
        version: r.version,
        deviceId: r.deviceId ?? '',
      });
      continue;
    }
    const change = byKey.get(key);
    if (!change) continue;
    base[key] = {
      v: r.version,
      h: change.hash,
      at,
      ...(change.payload === null ? { del: true as const } : {}),
    };
    if (edits[key]?.h === change.hash) delete edits[key];
  }
  return { team: { ...team, base, edits }, stale };
}

/**
 * The next pull cursor: the highest version such that every row up to it was written more than
 * `overlapMs` before the server's `now`. Newer rows are read again next time (and skipped by
 * version), so a write that committed late is never missed. `updatedAt` is the row's server
 * write time, stamped right after its version (`clock_timestamp()`); a write commits within the
 * server's 8 s statement timeout, so no uncommitted row can hide below the returned cursor.
 */
export function nextCursor(
  cursor: number,
  rows: readonly RemoteRecord[],
  serverNow: string,
  overlapMs = 10_000,
): number {
  const limit = time(normalizeTimestamp(serverNow) ?? serverNow) - overlapMs;
  let next = cursor;
  for (const row of [...rows].sort((a, b) => a.version - b.version)) {
    if (!(time(row.updatedAt) < limit)) break;
    next = Math.max(next, row.version);
  }
  return next;
}

/** The save time of every record of a team linked to an existing cloud team. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

/**
 * `edits` for linking a local team to a cloud team that already exists: every record is a change
 * saved at the epoch, so the cloud wins wherever both have a record and local-only records are
 * still pushed.
 */
export function adoptExisting(slice: TeamSlice): SyncedTeam['edits'] {
  const edits: Record<string, SyncEdit> = {};
  for (const [key, payload] of sliceToRecords(slice))
    edits[key] = { at: EPOCH, h: payloadHash(payload) };
  return edits;
}
