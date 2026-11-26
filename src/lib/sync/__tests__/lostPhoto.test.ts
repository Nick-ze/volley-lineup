/**
 * v10 audit (docs/AUDIT_V10.md M18, the rest of H3): a photo the cloud answers "not found" for.
 * Such an id was taken off the team's cloud photo list, so after the next app start the photo
 * prune cleared the `photoId` on a device that lacks the picture. On a manager device that is a
 * change: pushed as "no photo", it took the picture from every device that still had it.
 *
 * Now the id stays listed, and the prune never clears the `photoId` of a record that is exactly
 * what the server last had (also for lists an earlier app version already shortened).
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { prunePhotos, setPendingRemotePhotos, setPhoto, useAppStore, usePhotoStore } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { BackendError } from '../errors';
import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return { ...slice, teams: [slice.team] };
}

/** What an app restart forgets, and what runs at every app start before the engine. */
async function restart(device: TestDevice): Promise<void> {
  device.engine.pendingPhotos.clear();
  device.engine.lostPhotos.clear();
  device.engine.checkedFolders.clear();
  await device.act(async () => {
    setPendingRemotePhotos(new Set());
    await prunePhotos();
  });
}

const photoOf = (device: TestDevice, playerId: string) =>
  device.data.players.find((p) => p.id === playerId)?.photoId;
const cloudPhotoOf = (cloud: FakeCloud, playerId: string) =>
  (cloud.record(T1, 'player', playerId)?.payload as { photoId?: string } | undefined)?.photoId;

/**
 * A has the team with its pictures; B (another manager device of the account) lacks ph2, and
 * the cloud folder has lost it (removed by a device that didn't see the record still uses it).
 */
async function cloudLostPhoto() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  a.photos = { ph2: PHOTO, ph3: PHOTO };
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  cloud.photos.delete(`${T1}/ph2`);
  await b.act((e) => downloadTeams(e, [T1]));
  cloud.clock.tick(60_000);
  await b.cycle();
  expect(b.photos).toEqual({ ph3: PHOTO });
  expect(photoOf(b, 'p1')).toBe('ph2');
  return { cloud, a, b };
}

describe('a photo the cloud answers "not found" for (audit M18)', () => {
  it('keeps its photoId on a device that lacks the picture, also after a restart', async () => {
    const { b } = await cloudLostPhoto();
    await restart(b);
    expect(photoOf(b, 'p1')).toBe('ph2');
    expect(b.data.sync.teams[T1].photos.sort()).toEqual(['ph2', 'ph3']);
  });

  it('isn’t pushed as "no photo": the device that still has the picture keeps it', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    await restart(b);
    cloud.clock.tick(60_000);
    await b.cycle();
    await b.cycle();
    expect(cloudPhotoOf(cloud, 'p1')).toBe('ph2');
    expect(b.runtime.status.pending).toBe(0);
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(photoOf(a, 'p1')).toBe('ph2');
    expect(a.photos.ph2).toBe(PHOTO);
  });

  it('a change of that record on the device without the picture still syncs, picture kept', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    await restart(b);
    cloud.clock.tick(60_000);
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Renamed' } : p)),
    }));
    await b.cycle();
    // Before: the record waited for an upload of a picture this device doesn't have, and after
    // the next restart it went out without its photo.
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({
      firstName: 'Renamed',
      photoId: 'ph2',
    });
    expect(b.runtime.status.pending).toBe(0);
    await restart(b);
    await b.cycle();
    expect(cloudPhotoOf(cloud, 'p1')).toBe('ph2');
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(a.data.players.find((p) => p.id === 'p1')?.firstName).toBe('Renamed');
    expect(photoOf(a, 'p1')).toBe('ph2');
    expect(a.photos.ph2).toBe(PHOTO);
  });

  it('comes back when another device uploads it again', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    await restart(b);
    // A (which has the picture) puts it back; B's next cycle downloads it.
    const anna = cloud.device();
    anna.signInAs('anna@example.test');
    await anna.uploadPhoto(T1, 'ph2', a.photos.ph2);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);
  });

  it('a list an earlier app version already shortened: the record’s photoId is still kept', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    // What 10.0.0 stored after the "not found": the id off the list.
    await b.edit((s) => ({
      sync: {
        ...s.sync,
        teams: { ...s.sync.teams, [T1]: { ...s.sync.teams[T1], photos: ['ph3'] } },
      },
    }));
    await restart(b);
    expect(photoOf(b, 'p1')).toBe('ph2');
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(cloudPhotoOf(cloud, 'p1')).toBe('ph2');
    await a.cycle();
    expect(photoOf(a, 'p1')).toBe('ph2');
  });

  it('still clears a photoId this device set itself whose picture was never saved', async () => {
    const { cloud, b } = await cloudLostPhoto();
    await b.act(() => useAppStore.getState().updatePlayer('p2', { photoId: 'never-saved' }));
    await b.act(() => prunePhotos());
    expect(photoOf(b, 'p2')).toBeUndefined();
    await b.cycle();
    expect(cloudPhotoOf(cloud, 'p2')).toBeUndefined();
  });

  it('on a view-only device the picture’s id survives a restart too', async () => {
    const { cloud, a } = await cloudLostPhoto();
    const viewer = new TestDevice(cloud, 'dev-v');
    await viewer.signIn('vera@example.test');
    const invite = await a.act((e) => createInvite(e, T1, 'player', 7));
    if (!invite.ok) throw new Error('no invite');
    await viewer.act((e) => joinTeam(e, invite.value.code));
    await viewer.cycle();
    expect(photoOf(viewer, 'p1')).toBe('ph2');
    await restart(viewer);
    expect(photoOf(viewer, 'p1')).toBe('ph2');
  });
});

describe('found by the independent review of the M18 fix', () => {
  /** The stored list as app version 10.0.0 left it after "not found": without that photo. */
  const shorten = (device: TestDevice, photos: string[]) =>
    device.edit((s) => ({
      sync: { ...s.sync, teams: { ...s.sync.teams, [T1]: { ...s.sync.teams[T1], photos } } },
    }));
  const rename = (device: TestDevice, firstName: string) =>
    device.act(() => useAppStore.getState().updatePlayer('p1', { firstName }));
  const folderChecks = (cloud: FakeCloud) => cloud.calls.filter((c) => c === 'listPhotos').length;

  it('a shortened list gets the id back at the app start', async () => {
    const { b } = await cloudLostPhoto();
    await shorten(b, ['ph3']);
    await restart(b);
    expect(photoOf(b, 'p1')).toBe('ph2');
    expect([...b.data.sync.teams[T1].photos].sort()).toEqual(['ph2', 'ph3']);
  });

  it('a shortened list: a change of that record keeps the picture for everyone', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    await shorten(b, ['ph3']);
    await restart(b);
    cloud.clock.tick(60_000);
    await b.cycle();
    await rename(b, 'Renamed');
    expect(photoOf(b, 'p1')).toBe('ph2');
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({
      firstName: 'Renamed',
      photoId: 'ph2',
    });
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(photoOf(a, 'p1')).toBe('ph2');
    expect(a.photos.ph2).toBe(PHOTO);
  });

  it('a shortened list: the picture comes back when another device uploads it again', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    await shorten(b, ['ph3']);
    await restart(b);
    const anna = cloud.device();
    anna.signInAs('anna@example.test');
    await anna.uploadPhoto(T1, 'ph2', a.photos.ph2);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);
  });

  it('the team’s own picture is kept the same way', async () => {
    const { b } = await cloudLostPhoto();
    // The team's picture isn't on this device either, and its id is off the list too.
    await b.act(() => usePhotoStore.setState({ photos: {} }));
    await shorten(b, []);
    await restart(b);
    expect(b.data.teams[0].photoId).toBe('ph3');
    expect(photoOf(b, 'p1')).toBe('ph2');
    expect([...b.data.sync.teams[T1].photos].sort()).toEqual(['ph2', 'ph3']);
  });

  it('a device that got the picture back uploads it with the next change, also after a restart', async () => {
    const { cloud, b } = await cloudLostPhoto();
    await b.act(async () => {
      await setPhoto('ph2', PHOTO); // e.g. from a backup
    });
    await restart(b); // the "not found" of the last app run is forgotten
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(false);
    await rename(b, 'Again');
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(cloud.photos.get(`${T1}/ph2`)).toBe(PHOTO);
    expect(cloudPhotoOf(cloud, 'p1')).toBe('ph2');
  });

  it('a device that always had the picture repairs the cloud with the record’s next change', async () => {
    const { cloud, a, b } = await cloudLostPhoto();
    // A never asked the cloud for ph2 (it has it), so nothing told it that the folder lost it.
    await rename(a, 'Anna-Lena');
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(cloud.photos.get(`${T1}/ph2`)).toBe(PHOTO);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);
  });

  it('asks the folder once per app run, and only before a record with a picture is pushed', async () => {
    const { cloud, a } = await cloudLostPhoto();
    const before = folderChecks(cloud);
    // p2 has no picture: nothing to check.
    await a.act(() => useAppStore.getState().updatePlayer('p2', { firstName: 'No picture' }));
    await a.cycle();
    expect(folderChecks(cloud)).toBe(before);
    await rename(a, 'One');
    await a.cycle();
    expect(folderChecks(cloud)).toBe(before + 1);
    await rename(a, 'Two');
    await a.cycle();
    expect(folderChecks(cloud)).toBe(before + 1);
    // After an app start it is asked again.
    await restart(a);
    await rename(a, 'Three');
    await a.cycle();
    expect(folderChecks(cloud)).toBe(before + 2);
  });

  it('a folder that can’t be listed doesn’t hold the push up; the next push asks again', async () => {
    const { cloud, a } = await cloudLostPhoto();
    const list = a.backend.listPhotos.bind(a.backend);
    a.backend.listPhotos = async () => {
      throw new BackendError('unknown', '500');
    };
    await rename(a, 'One');
    await a.cycle();
    expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ firstName: 'One' });
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(false);
    a.backend.listPhotos = list;
    await rename(a, 'Two');
    await a.cycle();
    expect(cloud.photos.get(`${T1}/ph2`)).toBe(PHOTO);
  });

  it('without a connection the push ends as offline, as before', async () => {
    const { a } = await cloudLostPhoto();
    a.backend.listPhotos = async () => {
      throw new TypeError('Network request failed');
    };
    await rename(a, 'One');
    await a.cycle();
    expect(a.runtime.status.phase).toBe('offline');
    expect(a.runtime.status.pending).toBe(1);
  });
});
