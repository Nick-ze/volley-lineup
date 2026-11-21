import { createId } from '@/lib/id';
import { setPhoto } from '@/store';

/**
 * A form's picture until Save: keep the current one, a newly picked one (data URI, not stored
 * yet) or removed. Kept in React state so an unsaved picture never reaches the photo store.
 */
export type PhotoDraft = { kind: 'keep' } | { kind: 'new'; uri: string } | { kind: 'removed' };

export const KEEP_PHOTO: PhotoDraft = { kind: 'keep' };

/** True when the form would save a picture (the current one or a new one). */
export function draftHasPhoto(draft: PhotoDraft, currentPhotoId: string | undefined): boolean {
  if (draft.kind === 'keep') return currentPhotoId !== undefined;
  return draft.kind === 'new';
}

/**
 * Saves the form's picture on Save. `attach` points the profile / player at the photo
 * (`undefined` removes it; the photo store then prunes the old one).
 *
 * A new picture gets a new id and goes into the photo store first; `setPhoto` updates the
 * in-memory photos synchronously, so `attach` runs right after it, before anything else can
 * change the profiles or players and prune the not yet referenced photo. The returned promise
 * resolves once the photo is written to storage.
 */
export function applyPhotoDraft(
  draft: PhotoDraft,
  attach: (photoId: string | undefined) => void,
): Promise<void> {
  if (draft.kind === 'keep') return Promise.resolve();
  if (draft.kind === 'removed') {
    attach(undefined);
    return Promise.resolve();
  }
  const id = createId();
  const saved = setPhoto(id, draft.uri);
  attach(id);
  // A failed storage write drops the photo and the reference (photoStore `prunePhotos`).
  return saved.then(() => undefined);
}
