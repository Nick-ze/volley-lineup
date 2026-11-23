/**
 * v7 (app 6.0): profile / player pictures and confidential player descriptions — the pure
 * rules (docs/PLAN.md §25–26). No React, no storage.
 *
 * Pictures are small JPEGs (`PHOTO_SIZE` px, the UI resizes and compresses them) kept as data
 * URIs in their own storage (one key per photo, `src/store/photoStore.ts`), so the main store
 * stays small. Profiles and players only hold a `photoId`.
 */
import type { ManagerProfile, Photo, Player, Team } from './types';

/** Longest side of a stored picture, in px. */
export const PHOTO_SIZE = 256;
/** JPEG quality used when compressing a picture (0–1). */
export const PHOTO_QUALITY = 0.7;
/**
 * Longest data URI accepted (characters). A 256 px JPEG at 0.7 is ~10–30 KB (~14–40 K chars in
 * base64); the limit leaves room for an unusual image but rejects full-size photos.
 */
export const MAX_PHOTO_DATA_LENGTH = 200_000;
/** Longest player description, in characters (after trimming). */
export const MAX_DESCRIPTION_LENGTH = 1000;

const DATA_URI = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** True for a small base64 JPEG / PNG / WebP data URI. */
export function isPhotoDataUri(value: string): boolean {
  return value.length <= MAX_PHOTO_DATA_LENGTH && DATA_URI.test(value);
}

/** The photo ids that profiles and players refer to. */
export function referencedPhotoIds(data: {
  profiles: readonly Pick<ManagerProfile, 'photoId'>[];
  players: readonly Pick<Player, 'photoId'>[];
  /** v8 (data model v9): team pictures. */
  teams: readonly Pick<Team, 'photoId'>[];
}): Set<string> {
  const ids = new Set<string>();
  for (const x of [...data.profiles, ...data.players, ...data.teams]) {
    if (x.photoId !== undefined) ids.add(x.photoId);
  }
  return ids;
}

/** The photos that someone refers to (order kept); the rest are orphans. */
export function keepReferencedPhotos(
  photos: readonly Photo[],
  data: Parameters<typeof referencedPhotoIds>[0],
): Photo[] {
  const ids = referencedPhotoIds(data);
  return photos.filter((p) => ids.has(p.id));
}

/**
 * A description as stored: trimmed; `undefined` when blank (the field is left out). Longer
 * texts are cut to `MAX_DESCRIPTION_LENGTH`.
 */
export function normalizeDescription(text: string | undefined): string | undefined {
  const trimmed = (text ?? '').trim();
  return trimmed === '' ? undefined : trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
}

/** True for a description that may be stored (not blank, already trimmed, not too long). */
export function isValidDescription(text: string): boolean {
  return text !== '' && text === text.trim() && text.length <= MAX_DESCRIPTION_LENGTH;
}

/**
 * The item without one of its optional fields (the omit-from-a-generic idiom needs the one cast:
 * TypeScript types the rest as `Omit<T, K>`, which is a `T` because the field is optional).
 */
function omitOptional<T, K extends keyof T>(item: T, key: K): T {
  const { [key]: _omitted, ...rest } = item;
  return rest as T;
}

/** The player without their description (for exports that leave descriptions out). */
export function withoutDescription<T extends Pick<Player, 'description'>>(player: T): T {
  return player.description === undefined ? player : omitOptional(player, 'description');
}

/** The item without its `photoId` when that photo isn't among `photoIds`. */
export function withoutDanglingPhoto<T extends { photoId?: string }>(
  item: T,
  photoIds: Set<string>,
): T {
  if (item.photoId === undefined || photoIds.has(item.photoId)) return item;
  return omitOptional(item, 'photoId');
}
