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
import { parentKey } from './syncGraph';
import { parsePayload } from './syncSchema';
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

/** Rough size of the changes as one push request. */
export const batchBytes = (changes: readonly LocalChange[]): number =>
  changes.reduce((sum, c) => sum + changeBytes(c), 0);

/**
 * The changes as they must travel, in order: a match together with its sets (one server
 * transaction, so nobody ever pulls a new match without its sets), every other record alone.
 */
export function pushGroups(changes: readonly LocalChange[]): LocalChange[][] {
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
  return groups;
}

/**
 * The changes split into push batches of at most `max.count` records and `max.bytes` bytes, in
 * order. A match travels in the same batch as its sets (`pushGroups`); a group bigger than the
 * limits gets a batch of its own.
 */
export function pushBatches(
  changes: readonly LocalChange[],
  max: { count: number; bytes: number } = PUSH_LIMITS,
): LocalChange[][] {
  const groups = pushGroups(changes);
  const batches: LocalChange[][] = [];
  let batch: LocalChange[] = [];
  let bytes = 0;
  for (const group of groups) {
    const size = batchBytes(group);
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
 * A batch in two or more smaller ones (by size, groups kept whole), for a retry after a push
 * that timed out on a slow connection (v10 audit M5). A single group can't be split: `[batch]`.
 */
export function halveBatch(batch: readonly LocalChange[]): LocalChange[][] {
  return pushBatches(batch, { count: batch.length, bytes: Math.ceil(batchBytes(batch) / 2) });
}

/**
 * What exactly a group pushes (its records and their content), to remember for the app run that
 * the server refused it: it is only sent again once something in it has changed.
 */
export function groupSignature(group: readonly LocalChange[]): string {
  return group.map((c) => `${c.key}@${c.hash}`).join('|');
}

/**
 * Why a change isn't pushed: this app itself would refuse the record when pulled (`invalid`: a
 * name over 200 or another text over 1000 characters), the server refused it as it is
 * (`refused`), or it belongs to a new record that isn't pushed (`parent`).
 */
export type HeldReason = 'invalid' | 'refused' | 'parent';

export interface HeldChange {
  change: LocalChange;
  reason: HeldReason;
}

/**
 * The changes that can be pushed (in order) and those that have to wait (v10 audit M3, M4):
 * - a record that fails the validation every device applies to pulled records (`parsePayload`).
 *   Pushed, it would sync to nobody ("records skipped" elsewhere) — and as the team's own record
 *   it would keep the whole team from being downloaded;
 * - a group the server refused with exactly this content (`refused`: `groupSignature`s of
 *   whole groups, or of single records of a match the server already has);
 * - every new record below a new record that waits. Pushed without its parent it would be
 *   skipped as an orphan on the other devices, and not pulled again when the parent arrives;
 * - a new match with all its sets when one of them waits (it must not arrive without them).
 * A record the server already has (`base`, not deleted there) doesn't hold what is below it, and
 * deletions always go (unless the server refused them).
 */
export function sendableChanges(
  changes: readonly LocalChange[],
  base: SyncedTeam['base'],
  teamId: string,
  refused: ReadonlySet<string> = new Set(),
): { ready: LocalChange[]; held: HeldChange[] } {
  const onServer = (key: string): boolean => base[key] !== undefined && !base[key].del;
  /** New records that aren't pushed: nothing new below them is pushed either. */
  const blocked = new Set<string>();
  const ready: LocalChange[] = [];
  const held: HeldChange[] = [];
  for (const group of pushGroups(changes)) {
    const wasRefused = refused.has(groupSignature(group));
    const reasons = new Map<LocalChange, HeldReason>();
    for (const c of group) {
      if (c.payload !== null && parsePayload(c.kind, c.id, c.payload) === null) {
        reasons.set(c, 'invalid');
      } else if (wasRefused || refused.has(groupSignature([c]))) {
        reasons.set(c, 'refused');
      } else if (c.payload !== null) {
        const parent = parentKey(teamId, c.key, c.payload);
        if (parent !== null && blocked.has(parent)) reasons.set(c, 'parent');
      }
    }
    const head = group[0];
    const newMatch = head.kind === 'match' && head.payload !== null && !onServer(head.key);
    for (const c of group) {
      const reason = reasons.get(c) ?? (newMatch && reasons.size > 0 ? 'parent' : undefined);
      if (reason === undefined) {
        ready.push(c);
        continue;
      }
      held.push({ change: c, reason });
      if (c.payload !== null && !onServer(c.key)) blocked.add(c.key);
    }
  }
  return { ready, held };
}

/** A short name for a record in a notice (its name fields; '' when it has none). */
export function recordLabel(change: Pick<LocalChange, 'kind' | 'payload'>, max = 40): string {
  const text = (field: string): string => {
    const value = change.payload?.[field];
    return typeof value === 'string' ? value.trim() : '';
  };
  const label =
    change.kind === 'player'
      ? `${text('firstName')} ${text('lastName')}`.trim()
      : change.kind === 'match'
        ? text('opponent')
        : text('name');
  const chars = [...label];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : label;
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
