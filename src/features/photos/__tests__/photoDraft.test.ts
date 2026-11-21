import { useAppStore, usePhotoStore } from '@/store';

import { applyPhotoDraft, draftHasPhoto, KEEP_PHOTO } from '../photoDraft';

const URI = 'data:image/jpeg;base64,AAAA';

beforeEach(() => {
  useAppStore.getState().resetAll();
  useAppStore.setState({ hydrated: true });
  usePhotoStore.setState({ photos: {}, hydrated: true });
});

describe('draftHasPhoto', () => {
  it('keeps the current photo, has a new one, has none when removed', () => {
    expect(draftHasPhoto(KEEP_PHOTO, 'a')).toBe(true);
    expect(draftHasPhoto(KEEP_PHOTO, undefined)).toBe(false);
    expect(draftHasPhoto({ kind: 'new', uri: URI }, undefined)).toBe(true);
    expect(draftHasPhoto({ kind: 'removed' }, 'a')).toBe(false);
  });
});

describe('applyPhotoDraft', () => {
  it('does nothing for "keep"', async () => {
    const attach = jest.fn();
    await applyPhotoDraft(KEEP_PHOTO, attach);
    expect(attach).not.toHaveBeenCalled();
  });

  it('detaches for "removed"', async () => {
    const attach = jest.fn();
    await applyPhotoDraft({ kind: 'removed' }, attach);
    expect(attach).toHaveBeenCalledWith(undefined);
  });

  it('stores a new photo under a new id before attaching it, so the prune keeps it', async () => {
    const { addProfile, updateProfile } = useAppStore.getState();
    const profile = addProfile({ name: 'Coach', color: '#FF6B00' });
    const ids: string[] = [];
    await applyPhotoDraft({ kind: 'new', uri: URI }, (photoId) => {
      expect(usePhotoStore.getState().photos[photoId as string]).toBe(URI);
      ids.push(photoId as string);
      updateProfile(profile.id, { photoId });
    });
    await applyPhotoDraft({ kind: 'new', uri: URI }, (photoId) => {
      ids.push(photoId as string);
      updateProfile(profile.id, { photoId });
    });
    expect(ids[0]).not.toBe(ids[1]);
    // The first one is now an orphan and has been pruned.
    expect(usePhotoStore.getState().photos).toEqual({ [ids[1]]: URI });
  });
});
