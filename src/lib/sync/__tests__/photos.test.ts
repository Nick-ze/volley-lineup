/**
 * v10 sync engine: team and player photos — uploaded before the records that use them,
 * downloaded before pulled records are applied, kept by the prune while a download is pending,
 * and removed from the cloud when nothing uses them any more.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { prunePhotos, setPhoto, useAppStore } from '@/store';
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

async function setup() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  a.photos = { ph2: PHOTO, ph3: PHOTO };
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  return { cloud, a, b };
}

describe('photos', () => {
  it('are uploaded before the records that refer to them', async () => {
    const { cloud, a } = await setup();
    const mark = cloud.calls.length;
    await a.act((e) => uploadTeams(e, ['t1'])); // the upload's own cycle pushes
    const calls = cloud.calls.slice(mark);
    expect(calls.lastIndexOf('uploadPhoto')).toBeLessThan(calls.indexOf('pushRecords'));
    expect(calls.filter((c) => c === 'uploadPhoto')).toHaveLength(2);
  });

  it('a record whose photo upload failed waits; the others go out', async () => {
    const { cloud, a } = await setup();
    const upload = a.backend.uploadPhoto.bind(a.backend);
    a.backend.uploadPhoto = async (teamId, photoId, uri) => {
      if (photoId === 'ph2') throw new BackendError('unknown', 'too_large');
      await upload(teamId, photoId, uri);
    };
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    expect(cloud.record('t1', 'player', 'p1')).toBeUndefined();
    expect(cloud.record('t1', 'player', 'p2')).toBeDefined();
    expect(a.runtime.status.pending).toBe(1);
  });

  it('are downloaded before the records are applied', async () => {
    const { cloud, a, b } = await setup();
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    const mark = cloud.calls.length;
    await b.act((e) => downloadTeams(e, ['t1']));
    expect(cloud.calls.slice(mark).filter((c) => c === 'downloadPhoto')).toHaveLength(2);
    expect(b.photos).toEqual({ ph2: PHOTO, ph3: PHOTO });
    expect(b.data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
  });

  it('a failed download stays pending: the prune keeps the photoId; retried next cycle', async () => {
    const { cloud, a, b } = await setup();
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    cloud.brokenPhotos.add('t1/ph2');
    await b.act((e) => downloadTeams(e, ['t1']));
    expect(b.photos).toEqual({ ph3: PHOTO });
    await b.act(async () => {
      await prunePhotos();
      expect(useAppStore.getState().players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    });
    cloud.brokenPhotos.clear();
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);
  });

  it('a new photo travels; the replaced one is removed from the cloud (manager devices)', async () => {
    const { cloud, a, b } = await setup();
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    await b.act((e) => downloadTeams(e, ['t1']));
    cloud.clock.tick(1000);
    await a.act(async () => {
      await setPhoto('ph-new', OTHER);
      useAppStore.getState().updatePlayer('p1', { photoId: 'ph-new' });
    });
    await a.cycle();
    expect(cloud.photos.has('t1/ph-new')).toBe(true);
    expect(cloud.photos.has('t1/ph2')).toBe(false);
    expect(a.data.sync.teams.t1.photos.sort()).toEqual(['ph-new', 'ph3']);
    await b.cycle();
    expect(b.data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph-new');
    expect(b.photos['ph-new']).toBe(OTHER);
  });

  // v10 audit M18: this test used to expect the id to be taken off the team's cloud photo list
  // ("forgotten as uploaded"). That was the bug: off the list, the `photoId` was cleared after
  // the next restart and pushed as "no photo" (see `lostPhoto.test.ts`). The id stays listed
  // now; what the old rule was for still holds — a device that has the picture uploads it again.
  it('a photo the cloud no longer has stays listed; a device that has it again uploads it', async () => {
    const { cloud, a, b } = await setup();
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    await b.act((e) => downloadTeams(e, ['t1']));
    expect(b.data.sync.teams.t1.photos.sort()).toEqual(['ph2', 'ph3']);
    // Another device removed ph2 meanwhile; device B now pulls a record that uses it.
    cloud.photos.delete('t1/ph2');
    b.photos = { ph3: PHOTO };
    cloud.clock.tick(1000);
    await a.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Changed' } : p)),
    }));
    await a.cycle();
    await b.cycle();
    expect(b.data.sync.teams.t1.photos.sort()).toEqual(['ph2', 'ph3']);
    expect(b.data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    // B gets the picture back (e.g. from a backup) and changes the player: uploaded again.
    cloud.clock.tick(1000);
    await b.act(async () => {
      await setPhoto('ph2', PHOTO);
      useAppStore.getState().updatePlayer('p1', { firstName: 'Again' });
    });
    await b.cycle();
    expect(cloud.photos.get('t1/ph2')).toBe(PHOTO);
    expect(cloud.record('t1', 'player', 'p1')?.payload).toMatchObject({
      firstName: 'Again',
      photoId: 'ph2',
    });
  });
});
