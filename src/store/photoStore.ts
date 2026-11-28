/**
 * v7 (app 6.0): pictures of profiles, players and (v8) teams (docs/PLAN.md §26, DECISIONS #148).
 *
 * Photos are kept out of the main store: each one is a small data URI under its own storage
 * key (`volley-lineup-photo:<id>`), so the main store stays small and fast to write (every
 * rally in live mode writes it) and no single stored value grows with the number of photos.
 * Profiles, players and teams only hold a `photoId`.
 *
 * - Loading starts when this module is imported; `whenPhotosLoaded()` waits for it (export /
 *   import await it; screens simply show the fallback until a photo has loaded).
 * - Photos nobody refers to are deleted automatically whenever profiles or players change
 *   (and after loading). So: save a new photo with `setPhoto` *before* pointing a profile /
 *   player at it, and keep an unsaved form's picture in local state, not here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { TransferData } from '@/domain/exportSchema';
import type { HostedData } from '@/domain/hostedTournament';
import { isCloudPhoto, referencedPhotoIds, withCloudPhotos } from '@/domain/photos';
import { isUnchangedRecord } from '@/domain/syncAccess';
import { playerRecordHash, recordKey, teamRecordHash } from '@/domain/syncRecords';
import type { Photo } from '@/domain/types';

import { selectAppData, useAppStore } from './appStore';

export const PHOTO_KEY_PREFIX = 'volley-lineup-photo:';
const keyOf = (id: string) => `${PHOTO_KEY_PREFIX}${id}`;

interface PhotoState {
  /** photo id → data URI */
  photos: Record<string, string>;
  /** True once the stored photos have been read. */
  hydrated: boolean;
}

export const usePhotoStore = create<PhotoState>()(() => ({ photos: {}, hydrated: false }));

/** Writes / deletes storage keys; false when that failed (storage full or unavailable). */
async function persist(write: Record<string, string>, remove: readonly string[]): Promise<boolean> {
  try {
    const entries = Object.entries(write).map(([id, uri]): [string, string] => [keyOf(id), uri]);
    if (entries.length > 0) await AsyncStorage.multiSet(entries);
    if (remove.length > 0) await AsyncStorage.multiRemove(remove.map(keyOf));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves (or replaces) a photo: in memory at once, then in storage. Resolves false when the
 * storage write failed; the photo is then dropped from memory too, and whoever points at it is
 * cleared by `prunePhotos` (no dangling `photoId`, v6 QA).
 */
export async function setPhoto(id: string, dataUri: string): Promise<boolean> {
  usePhotoStore.setState((s) => ({ photos: { ...s.photos, [id]: dataUri } }));
  const ok = await persist({ [id]: dataUri }, []);
  if (!ok) {
    usePhotoStore.setState((s) => {
      const { [id]: _failed, ...photos } = s.photos;
      return { photos };
    });
    await prunePhotos();
  }
  return ok;
}

/**
 * Deletes a photo.
 * @internal Not used by the app (photos go through `prunePhotos`); kept for the storage tests.
 */
export async function removePhoto(id: string): Promise<void> {
  usePhotoStore.setState((s) => {
    const { [id]: _removed, ...photos } = s.photos;
    return { photos };
  });
  await persist({}, [id]);
}

/**
 * The given photos become all photos.
 * @internal Not used by the app since the v10 audit (the import adds the result's photos with
 * `putPhotos` and lets the prune remove the rest, so nothing is awaited between reading and
 * writing the store); kept for the storage tests.
 */
export async function replacePhotos(list: readonly Photo[]): Promise<void> {
  const next = Object.fromEntries(list.map((p) => [p.id, p.dataUri]));
  const removed = Object.keys(usePhotoStore.getState().photos).filter((id) => !(id in next));
  usePhotoStore.setState({ photos: next });
  await persist(next, removed);
}

/**
 * Import: adds / replaces the given photos, keeps the others. They are in memory before this
 * function first waits (the import relies on it: it points records at them in the same step),
 * then written to storage.
 */
export async function putPhotos(list: readonly Photo[]): Promise<void> {
  const added = Object.fromEntries(list.map((p) => [p.id, p.dataUri]));
  usePhotoStore.setState((s) => ({ photos: { ...s.photos, ...added } }));
  await persist(added, []);
}

/**
 * v10: photo ids that shared teams refer to but that haven't been downloaded yet. The prune
 * leaves those `photoId`s alone (otherwise a manager device would push "no photo" to everyone).
 * Set by the sync engine; replaced as a whole on every call. In memory only: after a restart the
 * prune relies on the stored list of the team's cloud photos instead (`isCloudPhoto`).
 */
let pendingRemotePhotos: ReadonlySet<string> = new Set();

export function setPendingRemotePhotos(ids: ReadonlySet<string>): void {
  pendingRemotePhotos = new Set(ids);
}

/** All photos as a list (for export). */
export function photoList(): Photo[] {
  return Object.entries(usePhotoStore.getState().photos).map(([id, dataUri]) => ({ id, dataUri }));
}

/** The data URI of a photo id, or null (none / not loaded yet). Re-renders on change. */
export function usePhotoUri(photoId: string | undefined): string | null {
  return usePhotoStore((s) => (photoId === undefined ? null : (s.photos[photoId] ?? null)));
}

/**
 * Deletes the photos no profile, player or (v8) team refers to, and (v6 QA) clears a `photoId` whose
 * photo is missing, e.g. after a failed storage write — only once both stores have loaded.
 */
export async function prunePhotos(): Promise<void> {
  const app = useAppStore.getState();
  const { photos, hydrated } = usePhotoStore.getState();
  if (!hydrated || !app.hydrated) return;
  const dangling = (x: { photoId?: string }) =>
    x.photoId !== undefined && !(x.photoId in photos) && !pendingRemotePhotos.has(x.photoId);
  // v10 audit H3: a shared team's cloud photo that isn't on the device (yet) keeps its `photoId`,
  // whatever the in-memory download list says (it is empty after a restart).
  // v10 audit M18: so does the `photoId` of a record that is exactly what the server last had
  // — it came from the cloud, also when the folder list doesn't name it (the cloud answered
  // "not found" for it on an earlier app version). Clearing it on a manager device would be
  // pushed as "no photo" and take the picture from the devices that still have it. Such an id
  // goes back on the team's list (`adopt`), so that it also survives the record's next change.
  const adopt = new Map<string, Set<string>>();
  const fromCloud = (teamId: string, photoId: string | undefined, key: string, hash: string) => {
    if (isCloudPhoto(app.sync, teamId, photoId)) return true;
    if (photoId === undefined || !isUnchangedRecord(app.sync, teamId, key, hash)) return false;
    adopt.set(teamId, (adopt.get(teamId) ?? new Set<string>()).add(photoId));
    return true;
  };
  const players = app.players.filter(
    (p) =>
      dangling(p) &&
      !fromCloud(p.teamId, p.photoId, recordKey('player', p.id), playerRecordHash(p)),
  );
  const teams = app.teams.filter(
    (x) => dangling(x) && !fromCloud(x.id, x.photoId, recordKey('team', x.id), teamRecordHash(x)),
  );
  if (adopt.size > 0) {
    app.syncTransaction((s) => {
      const sync = withCloudPhotos(s.sync, adopt);
      return sync === s.sync ? s : { sync };
    });
  }
  for (const p of app.profiles.filter(dangling)) app.updateProfile(p.id, { photoId: undefined });
  for (const p of players) app.updatePlayer(p.id, { photoId: undefined });
  for (const x of teams) app.updateTeam(x.id, { photoId: undefined });
  const keep = referencedPhotoIds(app);
  const orphans = Object.keys(photos).filter((id) => !keep.has(id));
  if (orphans.length === 0) return;
  usePhotoStore.setState((s) => ({
    photos: Object.fromEntries(Object.entries(s.photos).filter(([id]) => keep.has(id))),
  }));
  await persist({}, orphans);
}

/** Reads every stored photo. */
export async function loadPhotos(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PHOTO_KEY_PREFIX));
    const pairs = keys.length === 0 ? [] : await AsyncStorage.multiGet(keys);
    const loaded: Record<string, string> = {};
    for (const [key, value] of pairs) {
      if (value !== null) loaded[key.slice(PHOTO_KEY_PREFIX.length)] = value;
    }
    // Photos saved while loading win over the stored copies.
    usePhotoStore.setState((s) => ({ photos: { ...loaded, ...s.photos }, hydrated: true }));
  } catch {
    usePhotoStore.setState({ hydrated: true });
  }
  await prunePhotos();
}

let loading: Promise<void> | null = null;

/** Resolves once the stored photos have been read (starts loading if needed). */
export function whenPhotosLoaded(): Promise<void> {
  loading ??= loadPhotos();
  return loading;
}

/** Tests only: forget the photos and load again on the next `whenPhotosLoaded()`. */
export function resetPhotoStoreForTests(): void {
  loading = null;
  pendingRemotePhotos = new Set();
  usePhotoStore.setState({ photos: {}, hydrated: false });
}

// Prune whenever the profiles, players or (v8) teams change (e.g. a player deleted, a photo replaced, an
// import, "Delete all data") and once the main store has loaded.
useAppStore.subscribe((state, prev) => {
  if (
    state.profiles !== prev.profiles ||
    state.players !== prev.players ||
    state.teams !== prev.teams ||
    state.hydrated !== prev.hydrated
  ) {
    void prunePhotos();
  }
});

void whenPhotosLoaded();

/**
 * The main store's data plus the photos as they are right now, without waiting. Only after
 * `whenPhotosLoaded()`; for code that must read and write the store in one step (the import).
 */
export function transferSnapshotNow(): TransferData & HostedData {
  return { ...selectAppData(useAppStore.getState()), photos: photoList() };
}

/** Everything an export needs: the main store's data plus the photos (waits for them). */
export async function transferSnapshot(): Promise<TransferData & HostedData> {
  await whenPhotosLoaded();
  return transferSnapshotNow();
}
