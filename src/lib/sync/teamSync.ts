/**
 * v10: one shared team's part of a sync cycle (docs/V10_SYNC_DESIGN.md §3.3–3.5), following the
 * engine rules in `src/domain/syncMerge.ts`:
 * - pull: every page since the cursor (paged by the raw rows' versions), photos downloaded, then
 *   all pages merged at once in one store write — local changes noted (`detectChanges`) right
 *   before, in the same write. The cursor doesn't move while the team itself hasn't arrived; such
 *   a team is pulled completely again only when its own record has changed (audit M6).
 * - push (managers): changes noted, photos uploaded first, batches pushed; every result is
 *   applied in one store write (records the server kept a newer save of are merged back).
 * - a match this device was scoring that another device took over (`holdState.ts`, audit M1):
 *   the pull lets that device's rows win, the push leaves the match and its sets out.
 * - photo clean-up after a push.
 */
import {
  batchBytes,
  detectChanges,
  edgePhotoIds,
  groupSignature,
  halveBatch,
  pushBatches,
  pushGroups,
  recordLabel,
  sendableChanges,
  type HeldChange,
  type LocalChange,
} from '@/domain/syncChanges';
import {
  applyPushResults,
  mergeRemote,
  nextCursor,
  resetToCloudMerge,
  type MergeInput,
  type MergeOutput,
  type PushOutcome,
} from '@/domain/syncMerge';
import { goneTeamLinks, isGoneLink, withoutTeamLinks } from '@/domain/syncAccess';
import { foreignKeys, matchOfRecord, parseRecordKey, type TeamSlice } from '@/domain/syncRecords';
import {
  normalizeTimestamp,
  parseRemoteRow,
  textFits,
  type RemoteRecord,
} from '@/domain/syncSchema';
import type { SyncedTeam } from '@/domain/types';
import { useSyncRuntime, type AppState } from '@/store';

import type { PushItem } from './backend';
import { isoNow, type EngineCore } from './core';
import { isRefusedContent, isTimeout } from './errors';
import { yieldedNow } from './holdState';
import {
  collectGarbage,
  downloadPhotos,
  forgetPhotos,
  remotePhotoIds,
  settleDownloads,
  slicePhotoIds,
  uploadPhotos,
} from './photoSync';
import {
  appState,
  dropNotices,
  notify,
  sliceOf,
  teamData,
  teamName,
  transaction,
  withSlice,
  withTeamMeta,
} from './storeOps';

/** Rows per `pull_changes` page. */
export const PULL_PAGE = 500;

export interface PullReport {
  /** Rows skipped because their ids belong to another team on the device (don't push then). */
  foreign: number;
  /** Rows that failed validation. */
  invalid: number;
  /** The team is on the device after the pull. */
  present: boolean;
  /** A `reset` pull replaced the team with the cloud's copy (its team row was in the pull). */
  replaced: boolean;
  /** Unsynced changes to matches another device took over that gave way to the scorer's rows. */
  yielded: number;
  /** The team can't be shown yet: its own record hasn't arrived or can't be read (audit M6). */
  waiting: boolean;
}

const NOTHING_PULLED: PullReport = {
  foreign: 0,
  invalid: 0,
  present: false,
  replaced: false,
  yielded: 0,
  waiting: false,
};

/**
 * True when a linked team is gone from the device (deleted locally): its sync state is dropped,
 * nothing is deleted on the server. A team linked but never pulled (a download in progress) is
 * not gone.
 */
export const isGone = (meta: SyncedTeam, slice: TeamSlice | undefined): boolean =>
  isGoneLink(meta, slice !== undefined);

/**
 * Unlinks every shared team that is gone from the device (audit C1). The store's own delete
 * actions unlink in the same write; this catches links an earlier app version left behind. It
 * needs no session: a stale link must not wait for the next sign-in, or a backup restored in
 * between would be rebuilt under it and pushed as deletions.
 */
export function dropGoneTeams(core: EngineCore): void {
  const s = appState();
  const gone = goneTeamLinks(s.sync, s.teams);
  if (gone.length === 0) return;
  transaction((state) => {
    const sync = withoutTeamLinks(state.sync, goneTeamLinks(state.sync, state.teams));
    return sync === state.sync ? state : { sync };
  });
  for (const teamId of gone) {
    forgetPhotos(core, teamId);
    core.resetPending.delete(teamId);
    core.awaited.delete(teamId);
  }
}

/**
 * Whether the team's next pull replaces it with the cloud's copy (`resetToCloudMerge`): after a
 * demotion, or a viewer adopting an old local copy. Read from the persisted state (a viewer
 * with cursor 0 and a `base`), so it survives an app restart before that pull.
 */
export function needsReset(core: EngineCore, teamId: string): boolean {
  const meta = appState().sync.teams[teamId];
  if (core.resetPending.has(teamId)) return true;
  return (
    meta !== undefined &&
    meta.role === 'player' &&
    meta.cursor === 0 &&
    Object.keys(meta.base).length > 0
  );
}

const union = (a: readonly string[], b: readonly string[]): string[] =>
  b.every((x) => a.includes(x)) ? [...a] : [...new Set([...a, ...b])];

/** The profile a team that isn't on the device yet goes to. */
function profileFor(s: AppState, slice: TeamSlice | undefined): string {
  return slice?.team.profileId ?? s.sync.account?.profileId ?? s.currentProfileId ?? '';
}

function maxVersion(rows: readonly unknown[]): number {
  let max = -1;
  for (const row of rows) {
    const v = (row as { version?: unknown } | null)?.version;
    if (typeof v === 'number' && v > max) max = v;
  }
  return max;
}

/** A raw row's version and server write time: all the cursor rule needs. */
type RowMark = Pick<RemoteRecord, 'version' | 'updatedAt'>;

function rowMark(raw: unknown): RowMark | null {
  const row = raw as { version?: unknown; updated_at?: unknown } | null;
  const updatedAt = typeof row?.updated_at === 'string' ? normalizeTimestamp(row.updated_at) : null;
  return typeof row?.version === 'number' && updatedAt !== null
    ? { version: row.version, updatedAt }
    : null;
}

interface Pulled {
  /** The rows that passed `parseRemoteRow`. */
  rows: RemoteRecord[];
  /** How many rows didn't. */
  invalid: number;
  /** The first page's server time. */
  serverNow: string | null;
  /** The highest version of a `team` row among the raw rows, readable or not (-1: none). */
  teamRow: number;
  /** Every raw row with a version and a write time, readable or not. */
  marks: RowMark[];
}

/** Every page of the team's rows after `after` (paged by the raw rows' versions). */
async function pullPages(core: EngineCore, teamId: string, after: number): Promise<Pulled> {
  const pulled: Pulled = { rows: [], invalid: 0, serverNow: null, teamRow: -1, marks: [] };
  for (;;) {
    const page = await core.backend.pullChanges(teamId, after, PULL_PAGE);
    // The cursor's 10 s overlap counts from the FIRST page's server time (audit H4): a write
    // still uncommitted when page 1 was read can sit below page 1's newest rows, and no later
    // page returns it. Every later page is read later, so the first time is safe for all rows.
    pulled.serverNow ??= page.serverNow;
    for (const raw of page.rows) {
      const row = parseRemoteRow(raw);
      if (row) pulled.rows.push(row);
      else pulled.invalid += 1;
      if ((raw as { kind?: unknown } | null)?.kind === 'team') {
        pulled.teamRow = Math.max(pulled.teamRow, maxVersion([raw]));
      }
      const mark = rowMark(raw);
      if (mark) pulled.marks.push(mark);
    }
    const top = maxVersion(page.rows);
    if (page.rows.length < PULL_PAGE || top <= after) return pulled;
    after = top;
  }
}

/**
 * v10 audit M6, for a linked team that isn't on the device: true when nothing can be gained from
 * a complete pull, because the last one (in this app run) brought no readable record of the team
 * itself and no newer `team` row has shown up since. Asks only for the rows after that pull's
 * position; the position then moves on by the cursor rule of a normal pull, so a `team` row that
 * commits late is still seen. It is never stored, so it may also pass rows this app version
 * can't read (a stored cursor never does: such rows are read again until a newer one arrives).
 */
async function stillWaiting(core: EngineCore, teamId: string): Promise<boolean> {
  const awaited = core.awaited.get(teamId);
  if (!awaited) return false;
  const news = await pullPages(core, teamId, awaited.cursor);
  if (news.teamRow > awaited.teamRow) return false;
  awaited.cursor = nextCursor(awaited.cursor, news.marks, news.serverNow ?? '');
  return true;
}

/** Merges `rows` into the team in the store state `s` (changes noted first). */
function mergeInto(
  s: AppState,
  teamId: string,
  meta: SyncedTeam,
  rows: readonly RemoteRecord[],
  now: string,
  reset = false,
  takenOver?: MergeInput['takenOver'],
): { out: MergeOutput; data: ReturnType<typeof withSlice>; changed: boolean } {
  const slice = sliceOf(s, teamId);
  const edits = detectChanges(slice, meta, now).edits;
  const input: MergeInput = {
    teamId,
    slice,
    team: edits === meta.edits ? meta : { ...meta, edits },
    rows,
    local: { profileId: profileFor(s, slice) },
    foreignIds: foreignKeys(teamData(s), teamId),
    takenOver,
  };
  const out = reset ? resetToCloudMerge(input) : mergeRemote(input);
  return { out, data: withSlice(s, teamId, out.slice), changed: out.slice !== slice };
}

/**
 * Photo ids the team's records on the device refer to that its cloud folder has (`meta.photos`):
 * `downloadPhotos` fetches those the device lacks. Derived from the stored state, so a download
 * that failed before a restart — or a photo that arrived with a refused push's newer row — is
 * fetched by the next pull (audit H3).
 */
function storedCloudPhotos(teamId: string): string[] {
  const s = appState();
  const cloud = s.sync.teams[teamId]?.photos ?? [];
  if (cloud.length === 0) return [];
  return [...slicePhotoIds(sliceOf(s, teamId))].filter((id) => cloud.includes(id));
}

/** Pulls and applies everything new of the team (`reset`: from 0, the cloud replaces all). */
export async function pullTeam(
  core: EngineCore,
  teamId: string,
  reset = false,
): Promise<PullReport> {
  const start = appState().sync.teams[teamId];
  if (!start) return { ...NOTHING_PULLED };
  const local = sliceOf(appState(), teamId);
  if (isGone(start, local)) {
    dropTeam(core, teamId);
    return { ...NOTHING_PULLED };
  }
  const here = local !== undefined;
  // Still linked after a request (the link can go meanwhile: an import, "Delete all data"):
  // only then is the team waited for (found by the review: the notice stayed for good).
  const linked = () => appState().sync.teams[teamId] !== undefined;
  if (here) core.awaited.delete(teamId);
  else if (await stillWaiting(core, teamId)) return { ...NOTHING_PULLED, waiting: linked() };
  const { rows, invalid, serverNow, teamRow, marks } = await pullPages(
    core,
    teamId,
    reset ? 0 : start.cursor,
  );
  if (!here && !rows.some((r) => r.kind === 'team' && r.id === teamId)) {
    // The team isn't on the device and its own record isn't among the rows (not saved yet, or
    // not readable by this app version): nothing can be applied — no photo is downloaded and
    // nothing is written. The cursor stays at 0, as always while the team isn't there; where
    // this pull got to is remembered for this app run instead (audit M6).
    if (!linked()) return { ...NOTHING_PULLED };
    core.awaited.set(teamId, { cursor: nextCursor(0, marks, serverNow ?? ''), teamRow });
    return { ...NOTHING_PULLED, waiting: true };
  }
  core.awaited.delete(teamId);
  const missing = await downloadPhotos(core, teamId, rows, storedCloudPhotos(teamId));

  const report: PullReport = { ...NOTHING_PULLED, invalid };
  const now = isoNow(core.clock);
  // Matches another device took over from this one (audit M1): other devices' rows win here.
  const yielded = yieldedNow(core);
  const takenOver =
    yielded.size > 0 ? { matches: yielded, deviceId: appState().sync.deviceId ?? '' } : undefined;
  let gaveWay: string[] = [];
  transaction((s) => {
    const meta = s.sync.teams[teamId];
    if (!meta) return s;
    const { out, data, changed } = mergeInto(s, teamId, meta, rows, now, reset, takenOver);
    gaveWay = out.yielded;
    report.foreign = out.skipped.filter((x) => x.reason === 'foreignId').length;
    report.invalid += out.skipped.filter((x) => x.reason === 'invalid').length;
    report.present = out.slice !== undefined;
    // `resetToCloudMerge` only replaces the team when its own row is among the rows.
    report.replaced = reset && rows.some((r) => r.kind === 'team' && r.id === teamId);
    const cursor = out.slice
      ? nextCursor(reset ? 0 : meta.cursor, rows, serverNow ?? '')
      : meta.cursor;
    // Not-found photos aren't in the cloud folder (any more): forget them, so a manager that
    // has one uploads it again with its next change.
    const photos = union(meta.photos, remotePhotoIds(rows)).filter((id) => !missing.has(id));
    const same =
      out.team === meta &&
      cursor === meta.cursor &&
      photos.length === meta.photos.length &&
      photos.every((id, i) => id === meta.photos[i]);
    if (same && !changed) return s;
    return {
      ...data,
      sync: withTeamMeta(s.sync, teamId, { ...out.team, cursor, photos }),
    };
  });
  settleDownloads(core, teamId);
  report.yielded = gaveWay.length;
  if (gaveWay.length > 0) notifyTakenOver(teamId, gaveWay);
  return report;
}

/** Tells the user that changes here gave way to the device that took over scoring. */
function notifyTakenOver(teamId: string, keys: readonly string[]): void {
  const first = parseRecordKey(keys[0]);
  const matchId = first ? matchOfRecord(first.kind, first.id) : null;
  const holder = (matchId ? useSyncRuntime.getState().holds[matchId]?.holderName : '') ?? '';
  notify({ kind: 'takenOver', teamId, teamName: teamName(teamId), holder, undone: keys.length });
}

/**
 * Notes the local changes of every shared team this device may edit, with the time now (one
 * store write; online or offline). A change must get its save time when it is made — not at the
 * next online cycle, or an older offline edit would win against a newer one from elsewhere.
 */
export function noteAll(core: EngineCore): void {
  dropGoneTeams(core);
  const now = isoNow(core.clock);
  transaction((s) => {
    let teams: Record<string, SyncedTeam> | null = null;
    for (const [teamId, meta] of Object.entries(s.sync.teams)) {
      if (meta.role !== 'manager') continue;
      const slice = sliceOf(s, teamId);
      if (!slice) continue;
      const { edits } = detectChanges(slice, meta, now);
      if (edits === meta.edits) continue;
      teams ??= { ...s.sync.teams };
      teams[teamId] = { ...meta, edits };
    }
    return teams ? { sync: { ...s.sync, teams } } : s;
  });
}

const toItem = (c: LocalChange): PushItem =>
  c.payload === null
    ? { kind: c.kind, id: c.id, at: c.at, deleted: true }
    : { kind: c.kind, id: c.id, at: c.at, payload: c.payload };

/** Notes the team's local changes in the store; returns them (none for viewers). */
function noteChanges(core: EngineCore, teamId: string): LocalChange[] {
  let changes: LocalChange[] = [];
  const now = isoNow(core.clock);
  transaction((s) => {
    const meta = s.sync.teams[teamId];
    if (!meta) return s;
    const detected = detectChanges(sliceOf(s, teamId), meta, now);
    changes = detected.changes;
    if (detected.edits === meta.edits) return s;
    return { sync: withTeamMeta(s.sync, teamId, { ...meta, edits: detected.edits }) };
  });
  return changes;
}

/** A push gives up (offline, with the back-off) after this many timeouts; see `pushTeam`. */
const MAX_PUSH_TIMEOUTS = 2;

/**
 * Batches aren't made smaller than this after timeouts: when this little doesn't get through,
 * the connection is gone, not slow, and one bad moment must not make every later push of the
 * app run go record by record.
 */
export const MIN_PUSH_BYTES = 16 * 1024;

/**
 * Tells the user once per app run that records of the team can't be saved to the cloud as they
 * are (v10 audit M3, M4), and takes the notice back when none is left.
 */
function reportHeld(core: EngineCore, teamId: string, held: readonly HeldChange[]): void {
  const own = held.filter((h) => h.reason !== 'parent');
  const key = `unsent:${teamId}`;
  if (own.length === 0) {
    if (core.notified.delete(key)) dropNotices('unsent', teamId);
    return;
  }
  if (core.notified.has(key)) return;
  core.notified.add(key);
  notify({
    kind: 'unsent',
    teamId,
    teamName: teamName(teamId),
    count: own.length,
    label: recordLabel(own[0].change),
    reason:
      own[0].reason === 'refused'
        ? 'refused'
        : textFits(own[0].change.payload)
          ? 'invalid'
          : 'tooLong',
  });
}

/**
 * Pushes the team's local changes (managers only), then cleans up unused cloud photos.
 *
 * Not everything may go (v10 audit M3, M4, `sendableChanges`): a record this app would refuse
 * itself when pulled isn't sent; a batch the server refuses for its content is tried again in
 * halves until the group it refuses is found — that one is remembered and waits, with whatever
 * new belongs below it, and the rest is pushed. A batch that times out on a slow connection is
 * tried again in halves too, and later batches stay that small for the app run (v10 audit M5,
 * not below `MIN_PUSH_BYTES`); after `MAX_PUSH_TIMEOUTS` in one push the cycle ends as offline
 * and the next one continues with the smaller batches.
 */
export async function pushTeam(core: EngineCore, teamId: string, deviceId: string): Promise<void> {
  const meta = appState().sync.teams[teamId];
  if (!meta || meta.role !== 'manager' || !sliceOf(appState(), teamId)) return;
  // A match another device took over from this one isn't saved from here while that device's
  // hold lasts (audit M1): its changes stay noted and wait.
  const takenOver = yieldedNow(core);
  const changes = noteChanges(core, teamId).filter(
    (c) => !takenOver.has(matchOfRecord(c.kind, c.id) ?? ''),
  );
  const refused = core.refused.get(teamId) ?? new Set<string>();
  const plan = sendableChanges(changes, meta.base, teamId, refused);
  const held = [...plan.held];
  // Said before anything is sent: what this device won't push is known without a connection.
  if (held.length > 0) reportHeld(core, teamId, held);
  const sent = new Set<string>();
  const { uploaded, ready } = await uploadPhotos(
    core,
    teamId,
    plan.ready,
    edgePhotoIds(plan.ready, meta.photos),
  );
  let photos = uploaded;
  let timeouts = 0;
  const queue = pushBatches(ready, core.pushLimit);
  for (let batch = queue.shift(); batch !== undefined; batch = queue.shift()) {
    let results: PushOutcome[];
    try {
      results = await core.backend.pushRecords(teamId, deviceId, batch.map(toItem));
    } catch (e) {
      const single = pushGroups(batch).length === 1;
      if (isTimeout(e)) {
        const bytes = batchBytes(batch);
        // One group can't be split, and a small batch that gets no answer isn't a matter of
        // size: offline, as before.
        if (single || bytes <= MIN_PUSH_BYTES) throw e;
        // Too much for this connection (M5): this batch again in parts of at most half its
        // size, and everything after it that small too.
        core.pushLimit.bytes = Math.max(MIN_PUSH_BYTES, Math.ceil(bytes / 2));
        timeouts += 1;
        if (timeouts >= MAX_PUSH_TIMEOUTS) throw e;
        queue.splice(0, queue.length, ...pushBatches([...batch, ...queue.flat()], core.pushLimit));
        continue;
      }
      if (!isRefusedContent(e)) throw e;
      if (!single) {
        // Something in the batch (M4): the halves tell which.
        queue.unshift(...halveBatch(batch));
        continue;
      }
      const base = appState().sync.teams[teamId]?.base ?? meta.base;
      const head = base[batch[0].key];
      if (batch.length > 1 && head !== undefined && !head.del) {
        // A match the server already has needn't travel with its sets: each record alone
        // tells which one is refused, and the others still go.
        queue.unshift(...batch.map((c) => [c]));
        continue;
      }
      // The server refuses this group as it is: it waits until it has changed, and so does
      // whatever new belongs below it (pushed alone, other devices would skip it for good).
      refused.add(groupSignature(batch));
      core.refused.set(teamId, refused);
      const rest = sendableChanges([...batch, ...queue.flat()], base, teamId, refused);
      held.push(...rest.held);
      queue.splice(0, queue.length, ...pushBatches(rest.ready, core.pushLimit));
      continue;
    }
    const pushed = batch;
    for (const c of pushed) sent.add(c.key);
    const now = isoNow(core.clock);
    const added = photos;
    transaction((s) => {
      const current = s.sync.teams[teamId];
      if (!current) return s;
      const edits = detectChanges(sliceOf(s, teamId), current, now).edits;
      const applied = applyPushResults(
        { ...current, edits, photos: union(current.photos, added) },
        pushed,
        results,
      );
      if (applied.stale.length === 0) {
        return { sync: withTeamMeta(s.sync, teamId, applied.team) };
      }
      const { out, data } = mergeInto(s, teamId, applied.team, applied.stale, now);
      // Rows the server kept a newer save of are applied here without a pull: the photos they
      // point at are in the cloud folder (their writer uploaded them first). Those the merged
      // team now refers to are listed in the same write, so the prune keeps their `photoId`s
      // and the next pull downloads them (audit H3). A row that lost against a still newer
      // local change isn't listed: this device's clean-up must not remove a photo the
      // server's row points at.
      const used = slicePhotoIds(out.slice);
      const arrived = remotePhotoIds(applied.stale).filter((id) => used.has(id));
      const next = { ...out.team, photos: union(out.team.photos, arrived) };
      return { ...data, sync: withTeamMeta(s.sync, teamId, next) };
    });
    photos = [];
  }
  if (photos.length > 0) {
    const added = photos;
    transaction((s) => {
      const current = s.sync.teams[teamId];
      if (!current) return s;
      return {
        sync: withTeamMeta(s.sync, teamId, { ...current, photos: union(current.photos, added) }),
      };
    });
  }
  reportHeld(core, teamId, held);
  // A team or player record that wasn't pushed (it waits, or its photo couldn't be uploaded)
  // may show another picture here than its row in the cloud: no clean-up then, or the picture
  // that row still points at would be removed.
  const waiting = changes.some(
    (c) => (c.kind === 'team' || c.kind === 'player') && !sent.has(c.key),
  );
  if (!waiting) await cleanUpPhotos(core, teamId);
}

async function cleanUpPhotos(core: EngineCore, teamId: string): Promise<void> {
  const meta = appState().sync.teams[teamId];
  if (!meta || meta.role !== 'manager') return;
  const removed = await collectGarbage(core, teamId, meta.photos, sliceOf(appState(), teamId));
  if (removed.length === 0) return;
  transaction((s) => {
    const current = s.sync.teams[teamId];
    if (!current) return s;
    const photos = current.photos.filter((id) => !removed.includes(id));
    return { sync: withTeamMeta(s.sync, teamId, { ...current, photos }) };
  });
}

/** Stops syncing a team that is gone from the device. */
export function dropTeam(core: EngineCore, teamId: string): void {
  transaction((s) =>
    s.sync.teams[teamId] ? { sync: withTeamMeta(s.sync, teamId, undefined) } : s,
  );
  forgetPhotos(core, teamId);
  core.awaited.delete(teamId);
}
