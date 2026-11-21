import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from './appStore';
import {
  PHOTO_KEY_PREFIX,
  photoList,
  prunePhotos,
  putPhotos,
  removePhoto,
  replacePhotos,
  resetPhotoStoreForTests,
  setPhoto,
  transferSnapshot,
  usePhotoStore,
  whenPhotosLoaded,
} from './photoStore';

const uri = (c: string) => `data:image/jpeg;base64,${c}`;
const stored = async () =>
  Object.fromEntries(
    (await AsyncStorage.multiGet(
      (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PHOTO_KEY_PREFIX)),
    )) as [string, string][],
  );

beforeEach(async () => {
  await AsyncStorage.clear();
  useAppStore.getState().resetAll();
  useAppStore.setState({ hydrated: true });
  resetPhotoStoreForTests();
});

it('loads photos stored under their own keys', async () => {
  await AsyncStorage.setItem(`${PHOTO_KEY_PREFIX}a`, uri('AAAA'));
  await AsyncStorage.setItem('volley-lineup', '{}'); // the main store is not a photo
  const profile = useAppStore.getState().addProfile({ name: 'Coach', color: '#FF6B00' });
  useAppStore.getState().updateProfile(profile.id, { photoId: 'a' });
  await whenPhotosLoaded();
  expect(usePhotoStore.getState()).toEqual({ photos: { a: uri('AAAA') }, hydrated: true });
  expect(await whenPhotosLoaded()).toBeUndefined(); // loads once
});

it('saves, replaces and removes a photo in memory and in storage', async () => {
  await whenPhotosLoaded();
  const profile = useAppStore.getState().addProfile({ name: 'Coach', color: '#FF6B00' });
  await setPhoto('p1', uri('AAAA'));
  useAppStore.getState().updateProfile(profile.id, { photoId: 'p1' });
  await setPhoto('p1', uri('BBBB'));
  expect(usePhotoStore.getState().photos).toEqual({ p1: uri('BBBB') });
  expect(await stored()).toEqual({ [`${PHOTO_KEY_PREFIX}p1`]: uri('BBBB') });
  await removePhoto('p1');
  expect(usePhotoStore.getState().photos).toEqual({});
  expect(await stored()).toEqual({});
});

it('deletes photos nobody refers to when profiles or players change', async () => {
  await whenPhotosLoaded();
  const store = useAppStore.getState();
  const profile = store.addProfile({ name: 'Coach', color: '#FF6B00' });
  const team = store.addTeam({ profileId: profile.id, name: 'Herren' });
  await setPhoto('old', uri('AAAA'));
  const player = store.addPlayer({
    teamId: team.id,
    firstName: 'A',
    lastName: 'B',
    number: 7,
    positions: ['OH'],
    active: true,
    photoId: 'old',
  });
  await setPhoto('new', uri('BBBB'));
  useAppStore.getState().updatePlayer(player.id, { photoId: 'new' });
  await prunePhotos(); // the subscription already started it; wait for storage
  expect(Object.keys(usePhotoStore.getState().photos)).toEqual(['new']);
  useAppStore.getState().deletePlayer(player.id);
  await prunePhotos();
  expect(usePhotoStore.getState().photos).toEqual({});
  expect(await stored()).toEqual({});
});

it('does not prune before both stores have loaded', async () => {
  await setPhoto('x', uri('AAAA'));
  useAppStore.setState({ hydrated: false });
  await prunePhotos();
  expect(usePhotoStore.getState().photos).toEqual({ x: uri('AAAA') });
});

it('replace and merge for imports; the snapshot includes the photos', async () => {
  await whenPhotosLoaded();
  const profile = useAppStore.getState().addProfile({ name: 'Coach', color: '#FF6B00' });
  useAppStore.setState({ hydrated: false }); // keep the orphans for this test
  await setPhoto('a', uri('AAAA'));
  await replacePhotos([{ id: 'b', dataUri: uri('BBBB') }]);
  expect(photoList()).toEqual([{ id: 'b', dataUri: uri('BBBB') }]);
  await putPhotos([{ id: 'c', dataUri: uri('CCCC') }]);
  expect(photoList().map((p) => p.id)).toEqual(['b', 'c']);
  expect(Object.keys(await stored())).toEqual([`${PHOTO_KEY_PREFIX}b`, `${PHOTO_KEY_PREFIX}c`]);
  const snapshot = await transferSnapshot();
  expect(snapshot.profiles).toEqual([profile]);
  expect(snapshot.photos).toHaveLength(2);
});

it('keeps working when storage fails', async () => {
  const spy = jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('broken'));
  await whenPhotosLoaded();
  expect(usePhotoStore.getState().hydrated).toBe(true);
  const set = jest.spyOn(AsyncStorage, 'multiSet').mockRejectedValueOnce(new Error('full'));
  await setPhoto('a', uri('AAAA'));
  expect(usePhotoStore.getState().photos).toEqual({ a: uri('AAAA') });
  spy.mockRestore();
  set.mockRestore();
});
