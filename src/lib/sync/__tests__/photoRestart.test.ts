/**
 * v10 audit (docs/AUDIT_V10.md H3): a cloud photo that couldn't be downloaded must survive an app
 * restart. The "still downloading" list lives in memory only, so after a restart the photo prune
 * used to clear the `photoId`; a manager device then pushed "no photo" to the whole team and
 * removed the picture from the cloud.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { prunePhotos, setPendingRemotePhotos, useAppStore } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { BackendError } from '../errors';
import { downloadTeams, uploadTeams } from '../teamCommands';

const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const OTHER = 'data:image/jpeg;base64,/9j/AAAA';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return { ...slice, teams: [slice.team] };
}

/** What an app restart forgets: the engine's and the photo store's in-memory download lists. */
function restart(device: TestDevice): void {
  device.engine.pendingPhotos.clear();
  setPendingRemotePhotos(new Set());
}

/** Makes this device's downloads of `photoId` fail like a storage error (not "not found"). */
function breakDownload(device: TestDevice, photoId: string): () => void {
  const download = device.backend.downloadPhoto.bind(device.backend);
  device.backend.downloadPhoto = async (teamId, id) => {
    if (id === photoId) throw new BackendError('unknown', 'storage');
    return download(teamId, id);
  };
  return () => {
    device.backend.downloadPhoto = download;
  };
}

async function setup() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  a.photos = { ph2: PHOTO, ph3: PHOTO };
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test'); // the same account: a second manager device
  await a.act((e) => uploadTeams(e, ['t1']));
  await a.cycle();
  // Device B gets the team, but one photo download fails (not offline, not "not found": e.g.
  // the device's storage is full or the storage service answers with an error).
  const repair = breakDownload(b, 'ph2');
  await b.act((e) => downloadTeams(e, ['t1']));
  expect(b.photos).toEqual({ ph3: PHOTO });
  expect(b.data.sync.teams.t1.photos.sort()).toEqual(['ph2', 'ph3']);
  return { cloud, a, b, repair };
}

const photoOf = (device: TestDevice, playerId: string) =>
  device.data.players.find((p) => p.id === playerId)?.photoId;

describe('a photo that failed to download, after an app restart', () => {
  it('keeps its photoId on the device (the prune leaves cloud photos alone)', async () => {
    const { b } = await setup();
    restart(b);
    await b.act(async () => {
      await prunePhotos(); // runs at every app start, before the engine
      expect(useAppStore.getState().players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    });
  });

  it('is never pushed as "no photo" by a manager device, and stays in the cloud', async () => {
    const { cloud, a, b } = await setup();
    restart(b);
    await b.act(() => prunePhotos());
    cloud.clock.tick(5000);
    await b.cycle(); // still failing
    await a.cycle();
    expect(cloud.record('t1', 'player', 'p1')?.payload).toMatchObject({ photoId: 'ph2' });
    expect(cloud.photos.has('t1/ph2')).toBe(true);
    expect(photoOf(a, 'p1')).toBe('ph2');
    expect(a.photos.ph2).toBe(PHOTO);
  });

  it('is downloaded again once the download works', async () => {
    const { b, repair } = await setup();
    restart(b);
    await b.act(() => prunePhotos());
    repair();
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);
    expect(photoOf(b, 'p1')).toBe('ph2');
  });

  it('still clears a photoId the cloud never had (a failed local save)', async () => {
    const { b } = await setup();
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p2' ? { ...p, photoId: 'never-saved' } : p)),
    }));
    await b.act(() => prunePhotos());
    expect(photoOf(b, 'p2')).toBeUndefined();
  });
});

describe('a newer save with a new photo that arrives as a refused push', () => {
  it('keeps the photoId (no restart needed) and downloads the photo with the next pull', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    a.photos = { ph2: PHOTO, ph3: PHOTO };
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    await b.act((e) => downloadTeams(e, ['t1']));
    cloud.clock.tick(60_000);
    await b.cycle();

    // B changes p1. Between B's pull and B's push, another manager device saves p1 with a new
    // photo (uploaded first, as always) at a later time: B's push is refused and the server's
    // newer row comes back with the push result.
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Older' } : p)),
    }));
    cloud.clock.tick(5000);
    const other = cloud.device();
    other.signInAs('anna@example.test');
    const pull = b.backend.pullChanges.bind(b.backend);
    let between = true;
    b.backend.pullChanges = async (teamId, after, limit) => {
      const page = await pull(teamId, after, limit);
      if (between) {
        between = false;
        const payload = {
          ...(cloud.record('t1', 'player', 'p1')?.payload ?? {}),
          photoId: 'ph-new',
        };
        await other.uploadPhoto('t1', 'ph-new', OTHER);
        const at = new Date(cloud.clock.ms + 60_000).toISOString();
        await other.pushRecords('t1', 'dev-x', [{ kind: 'player', id: 'p1', at, payload }]);
      }
      return page;
    };
    await b.cycle();
    b.backend.pullChanges = pull;
    expect(photoOf(b, 'p1')).toBe('ph-new');
    await b.act(() => prunePhotos());
    expect(photoOf(b, 'p1')).toBe('ph-new');
    await b.cycle();
    expect(b.photos['ph-new']).toBe(OTHER);
    expect(cloud.record('t1', 'player', 'p1')?.payload).toMatchObject({ photoId: 'ph-new' });
    expect(cloud.photos.has('t1/ph-new')).toBe(true);
  });
});
