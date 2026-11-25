/**
 * v10: what a device has to push (docs/V10_SYNC_DESIGN.md §3.3, §3.4). Pure.
 *
 * A record is dirty when the hash of its payload differs from what the server last had
 * (`base`). The save time of a change is noted when it is first seen (`edits`), so a change keeps
 * its time until it is pushed, and undoing it back to the server's content forgets it. A record
 * that disappears while its team is still on the device becomes a tombstone; a team that
 * disappears is unlinked instead (never deleted on the server).
 */
import {
  payloadHash,
  parseSetRecordId,
  RECORD_KINDS,
  parseRecordKey,
  sliceToRecords,
  stableStringify,
  teamSlice,
  type RecordKind,
  type RecordPayload,
  type TeamData,
  type TeamSlice,
} from './syncRecords';
import type { SyncData, SyncEdit, SyncedTeam } from './types';

/** A record to push: its payload (null = deletion), hash (`''` = deletion) and save time. */
export interface LocalChange {
  key: string;
  kind: RecordKind;
  id: string;
  payload: RecordPayload | null;
  hash: string;
  at: string;
}

export interface DetectResult {
  changes: LocalChange[];
  /** The team's new `edits` (the same object when nothing changed). */
  edits: SyncedTeam['edits'];
  /** The team is gone from the device: drop its sync state, push nothing. */
  unlinked: boolean;
}

const kindOrder = (kind: RecordKind) => RECORD_KINDS.indexOf(kind);

function change(key: string, payload: RecordPayload | null, hash: string, at: string): LocalChange {
  const { kind, id } = parseRecordKey(key) as { kind: RecordKind; id: string };
  return { key, kind, id, payload, hash, at };
}

/**
 * The team's dirty records (push order: by kind, then the slice's order) and its new `edits`:
 * an edit is kept while its hash still matches (so its time stays), else stamped `now`;
 * records back at the server's content lose their edit. Viewers (role 'player') never push.
 */
export function detectChanges(
  slice: TeamSlice | undefined,
  team: SyncedTeam,
  now: string,
): DetectResult {
  if (!slice) return { changes: [], edits: team.edits, unlinked: true };
  if (team.role !== 'manager') return { changes: [], edits: team.edits, unlinked: false };
  const edits: Record<string, SyncEdit> = {};
  const changes: LocalChange[] = [];
  const stamp = (key: string, hash: string): SyncEdit => {
    const old = team.edits[key];
    const edit = old?.h === hash ? old : { at: now, h: hash };
    edits[key] = edit;
    return edit;
  };
  const records = sliceToRecords(slice);
  for (const [key, payload] of records) {
    const hash = payloadHash(payload);
    if (team.base[key]?.h === hash) continue;
    changes.push(change(key, payload, hash, stamp(key, hash).at));
  }
  for (const [key, base] of Object.entries(team.base)) {
    if (base.del || records.has(key)) continue;
    changes.push(change(key, null, '', stamp(key, '').at));
  }
  changes.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind));
  const oldKeys = Object.keys(team.edits);
  const same =
    oldKeys.length === Object.keys(edits).length &&
    oldKeys.every((k) => edits[k] === team.edits[k]);
  return { changes, edits: same ? team.edits : edits, unlinked: false };
}

/**
 * How many local changes wait for the server in the shared teams this device may edit (role
 * manager) that sync through `userId` (null: through any account).
 */
export function pendingCount(sync: SyncData, data: TeamData, userId: string | null): number {
  let count = 0;
  for (const [teamId, team] of Object.entries(sync.teams)) {
    if (userId !== null && team.userId !== userId) continue;
    count += detectChanges(teamSlice(data, teamId), team, '').changes.length;
  }
  return count;
}

export const PUSH_LIMITS = { count: 100, bytes: 512 * 1024 } as const;

/** Rough size of a change as pushed (the payload's JSON plus the row's other fields). */
const changeBytes = (c: LocalChange): number =>
  (c.payload === null ? 4 : stableStringify(c.payload).length) + c.key.length + 64;

/**
 * The changes split into push batches of at most `max.count` records and `max.bytes` bytes, in
 * order. A match travels in the same batch as its sets (one server transaction), so nobody ever
 * pulls a new match without its sets; a group bigger than the limits gets a batch of its own.
 */
export function pushBatches(
  changes: readonly LocalChange[],
  max: { count: number; bytes: number } = PUSH_LIMITS,
): LocalChange[][] {
  const groups: LocalChange[][] = [];
  const matchGroups = new Map<string, LocalChange[]>();
  for (const c of changes) {
    const matchId = c.kind === 'set' ? parseSetRecordId(c.id)?.matchId : undefined;
    const group = matchId === undefined ? undefined : matchGroups.get(matchId);
    if (group) {
      group.push(c);
      continue;
    }
    const own = [c];
    groups.push(own);
    if (c.kind === 'match') matchGroups.set(c.id, own);
  }
  const batches: LocalChange[][] = [];
  let batch: LocalChange[] = [];
  let bytes = 0;
  for (const group of groups) {
    const size = group.reduce((sum, c) => sum + changeBytes(c), 0);
    const fits = batch.length + group.length <= max.count && bytes + size <= max.bytes;
    if (!fits && batch.length > 0) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(...group);
    bytes += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

/**
 * Photo ids that team and player changes refer to but the team's cloud folder doesn't have yet
 * (`known`): they are uploaded before the records. Each id once, in order.
 */
export function edgePhotoIds(changes: readonly LocalChange[], known: readonly string[]): string[] {
  const seen = new Set(known);
  const ids: string[] = [];
  for (const c of changes) {
    if ((c.kind !== 'team' && c.kind !== 'player') || c.payload === null) continue;
    const photoId = c.payload.photoId;
    if (typeof photoId !== 'string' || seen.has(photoId)) continue;
    seen.add(photoId);
    ids.push(photoId);
  }
  return ids;
}
