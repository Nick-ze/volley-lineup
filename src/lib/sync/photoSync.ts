/**
 * v10: team and player photos of shared teams (docs/V10_SYNC_DESIGN.md §3.4, §3.5):
 * - pulled records' photos are downloaded *before* the records are applied; failures are kept in
 *   `pendingRemotePhotos` (so the photo prune doesn't clear those `photoId`s) and retried;
 * - photos a pushed record refers to are uploaded *before* the record;
 * - manager devices remove photos no record refers to any more (best effort);
 * - "Delete for everyone" / delete account remove a team's whole folder first.
 */
import { isPhotoDataUri } from '@/domain/photos';
import type { LocalChange } from '@/domain/syncChanges';
import type { RemoteRecord } from '@/domain/syncSchema';
import type { TeamSlice } from '@/domain/syncRecords';
import { setPendingRemotePhotos, setPhoto, usePhotoStore, whenPhotosLoaded } from '@/store';

import type { EngineCore } from './core';
import { isNotFound, toSyncError } from './errors';

const photoIdOf = (payload: Readonly<Record<string, unknown>> | null): string | null =>
  typeof payload?.photoId === 'string' ? payload.photoId : null;

/** Photo ids the pulled team and player records refer to. */
export function remotePhotoIds(rows: readonly RemoteRecord[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.kind !== 'team' && row.kind !== 'player') continue;
    const id = photoIdOf(row.payload);
    if (id !== null) ids.add(id);
  }
  return [...ids];
}

/** Photo ids the team and its players refer to on the device. */
export function slicePhotoIds(slice: TeamSlice | undefined): Set<string> {
  const ids = new Set<string>();
  for (const x of slice ? [slice.team, ...slice.players] : []) {
    if (x.photoId !== undefined) ids.add(x.photoId);
  }
  return ids;
}

function publishPending(core: EngineCore): void {
  const all = new Set<string>();
  for (const ids of core.pendingPhotos.values()) for (const id of ids) all.add(id);
  setPendingRemotePhotos(all);
}

/**
 * Downloads the photos of pulled records (and earlier failures, and `stored`: cloud photos the
 * records already on the device refer to) that the device doesn't have. They stay "pending"
 * until `settleDownloads` (after the records were applied). Returns the ids the cloud doesn't
 * have (not found: e.g. removed by another device meanwhile), so they are no longer counted as
 * uploaded and a manager that has one uploads it again. Rethrows when the connection is gone.
 */
export async function downloadPhotos(
  core: EngineCore,
  teamId: string,
  rows: readonly RemoteRecord[],
  stored: readonly string[] = [],
): Promise<Set<string>> {
  const missing = new Set<string>();
  const pending = core.pendingPhotos.get(teamId) ?? new Set<string>();
  const wanted = new Set([...remotePhotoIds(rows), ...pending, ...stored]);
  if (wanted.size === 0) return missing;
  await whenPhotosLoaded();
  core.pendingPhotos.set(teamId, pending);
  let offline: unknown = null;
  for (const id of wanted) {
    if (id in usePhotoStore.getState().photos) continue;
    pending.add(id);
    publishPending(core);
    if (offline) continue;
    try {
      const uri = await core.backend.downloadPhoto(teamId, id);
      if (isPhotoDataUri(uri)) await setPhoto(id, uri);
    } catch (e) {
      if (toSyncError(e) === 'offline') offline = e;
      else if (isNotFound(e)) missing.add(id);
    }
  }
  if (offline) throw offline;
  return missing;
}

/** After applying: photos now on the device are no longer pending. */
export function settleDownloads(core: EngineCore, teamId: string): void {
  const pending = core.pendingPhotos.get(teamId);
  if (!pending) return;
  const have = usePhotoStore.getState().photos;
  for (const id of [...pending]) if (id in have) pending.delete(id);
  if (pending.size === 0) core.pendingPhotos.delete(teamId);
  publishPending(core);
}

/** Forgets a team's pending downloads (it was unlinked). */
export function forgetPhotos(core: EngineCore, teamId: string): void {
  if (core.pendingPhotos.delete(teamId)) publishPending(core);
}

/**
 * Uploads the photos the changes refer to that the team's folder doesn't have yet. Returns the
 * uploaded ids and the changes that can be pushed (a record whose photo couldn't be uploaded
 * waits for the next cycle). Rethrows when the connection is gone.
 */
export async function uploadPhotos(
  core: EngineCore,
  teamId: string,
  changes: readonly LocalChange[],
  ids: readonly string[],
): Promise<{ uploaded: string[]; ready: LocalChange[] }> {
  if (ids.length === 0) return { uploaded: [], ready: [...changes] };
  await whenPhotosLoaded();
  const uploaded: string[] = [];
  const failed = new Set<string>();
  for (const id of ids) {
    const uri = usePhotoStore.getState().photos[id];
    if (uri === undefined) {
      failed.add(id);
      continue;
    }
    try {
      await core.backend.uploadPhoto(teamId, id, uri);
      uploaded.push(id);
    } catch (e) {
      if (toSyncError(e) === 'offline') throw e;
      failed.add(id);
    }
  }
  const ready = changes.filter((c) => {
    if (c.kind !== 'team' && c.kind !== 'player') return true;
    const id = photoIdOf(c.payload);
    return id === null || !failed.has(id);
  });
  return { uploaded, ready };
}

/** Removes the team's cloud photos no record refers to; returns the ids removed. */
export async function collectGarbage(
  core: EngineCore,
  teamId: string,
  known: readonly string[],
  slice: TeamSlice | undefined,
): Promise<string[]> {
  const used = slicePhotoIds(slice);
  const unused = known.filter((id) => !used.has(id));
  if (unused.length === 0) return [];
  try {
    await core.backend.removePhotos(teamId, unused);
    return unused;
  } catch {
    return [];
  }
}

/** Removes every photo of the team's folder (before deleting the team on the server). */
export async function removeAllPhotos(core: EngineCore, teamId: string): Promise<void> {
  const ids = await core.backend.listPhotos(teamId);
  if (ids.length > 0) await core.backend.removePhotos(teamId, ids);
}
