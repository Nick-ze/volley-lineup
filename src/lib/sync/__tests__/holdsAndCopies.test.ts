/**
 * v10 audit (docs/AUDIT_V10.md L17, M15, L31), with two devices on the fake cloud.
 *
 * L17 — a hold claim the server refuses without saying until when left a hold on this device
 * that never ran out (an unreadable time counts as "still running"): offline, the match stayed
 * read-only and — for the device that had been scoring it — held back for good.
 *
 * M15 — a match another device is scoring live could still be deleted from this one.
 *
 * L31 — a shared team's picture that hadn't been downloaded yet made every import fail.
 */
import { importWithSharedTeams, sharedTeamsOf } from '@/domain/syncImport';
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { SetEvent } from '@/domain/types';
import {
  canEditMatchNow,
  heldMatchesNow,
  prunePhotos,
  transferSnapshot,
  transferSnapshotNow,
  useAppStore,
} from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import { BackendError } from '../errors';
import { holdMatch, releaseMatch } from '../holdCommands';
import { createInvite } from '../memberCommands';
import { downloadTeams, joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const M = 'm2';
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';

function t1(photos = false): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  if (photos) return { ...slice, teams: [{ ...slice.team, profileId: PROFILE.id }] };
  return {
    ...slice,
    teams: [{ ...slice.team, profileId: PROFILE.id, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

async function twoManagers() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await b.edit((x) => ({ profiles: x.profiles.map((p) => ({ ...p, name: 'Ben' })) }));
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, 'manager', 7));
  if (!invite.ok) throw new Error('no invite');
  await b.act((e) => joinTeam(e, invite.value.code));
  await b.cycle();
  return { cloud, a, b };
}

type Winner = 'us' | 'them';
const winners = (events: readonly SetEvent[] | undefined): Winner[] =>
  (events ?? []).flatMap((e) => (e.type === 'point' ? [e.winner] : []));
const cloudRallies = (cloud: FakeCloud): Winner[] =>
  winners((cloud.record(T1, 'set', `${M}/1`)?.payload as { events?: SetEvent[] })?.events);
const score = (d: TestDevice, winner: Winner) =>
  d.edit((s) => ({
    matches: s.matches.map((m) =>
      m.id === M
        ? {
            ...m,
            sets: m.sets.map((x, i) =>
              i === 0 ? { ...x, events: [...x.events, { type: 'point' as const, winner }] } : x,
            ),
          }
        : m,
    ),
  }));

/** The server refuses this device's claims without an end time (`held_until` null → ''). */
function refuseWithoutEnd(d: TestDevice): void {
  const claim = d.backend.holdMatch.bind(d.backend);
  d.backend.holdMatch = async (...args) => {
    const result = await claim(...args);
    return result.granted ? result : { ...result, heldUntil: '' };
  };
}

describe('a refused hold without an end (audit L17)', () => {
  it('gets the server’s 15 minutes on this device instead of never running out', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M));
    refuseWithoutEnd(a);
    const refused = await a.act((e) => holdMatch(e, T1, M));
    expect(refused).toEqual({ ok: true, value: { granted: false, holder: 'Ben' } });
    const until = Date.parse(a.runtime.holds[M].heldUntil);
    expect(until).toBe(cloud.clock.ms + 15 * 60_000);
    expect(a.runtime.holds[M]).toMatchObject({ holderName: 'Ben', teamId: T1 });
    expect(a.runtime.holds[M].deviceId).not.toBe('dev-a');
  });

  it('a readable end from the server is kept as it is', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(5 * 60_000);
    await a.act((e) => holdMatch(e, T1, M));
    expect(a.runtime.holds[M].heldUntil).toBe(cloud.holds.get(`${T1}/${M}`)?.heldUntil);
  });

  it('the previous scorer, cut off after such a refusal, gets its rally out when the 15 minutes are over', async () => {
    const { cloud, a, b } = await twoManagers();
    // A scores live; B takes over; A's refresh is refused — without an end.
    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    await score(a, 'us');
    await a.cycle();
    cloud.clock.tick(2000);
    await b.act((e) => holdMatch(e, T1, M, true));
    refuseWithoutEnd(a);
    await score(a, 'them'); // scored before A noticed
    await a.act((e) => holdMatch(e, T1, M));
    expect(a.engine.yielded.has(M)).toBe(true);
    // From here A can't read the holds any more (the server answers with an error), so nothing
    // replaces the refused hold it knows.
    a.backend.listHolds = async () => {
      throw new BackendError('unknown', 'holds');
    };
    cloud.clock.tick(2000);
    await a.cycle();
    expect(cloudRallies(cloud)).toEqual(['us']); // held back while B's hold may still run
    cloud.clock.tick(16 * 60_000);
    await a.cycle();
    // Before: never — the hold without an end counted as running for good.
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
    expect(a.runtime.status.pending).toBe(0);
  });
});

describe('deleting while another device scores live (audit M15)', () => {
  /** `Date.now()` follows the fake cloud's clock (the screens read the real time). */
  const at = (cloud: FakeCloud) => jest.setSystemTime(cloud.clock.ms);
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'queueMicrotask',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
    });
  });
  afterEach(() => jest.useRealTimers());

  /** What the Delete buttons do when the question is answered. */
  const deleteMatchAsTheScreenDoes = () => {
    if (canEditMatchNow(M)) useAppStore.getState().deleteMatch(M);
  };

  it('the match B is scoring isn’t deleted from A; B’s rallies stay', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    await score(b, 'us');
    await b.cycle();
    cloud.clock.tick(2000);
    at(cloud);
    await a.cycle(); // A learns of the hold
    await a.act(() => {
      expect(heldMatchesNow([M, 'm1'])).toEqual([M]);
      expect(canEditMatchNow(M)).toBe(false);
      expect(canEditMatchNow('m1')).toBe(true);
      deleteMatchAsTheScreenDoes();
    });
    await a.cycle();
    expect(a.data.matches.some((m) => m.id === M)).toBe(true);
    expect(cloud.record(T1, 'match', M)?.deleted).toBe(false);
    cloud.clock.tick(2000);
    await score(b, 'them');
    await b.cycle();
    expect(cloudRallies(cloud)).toEqual(['us', 'them']);
    expect(b.data.matches.some((m) => m.id === M)).toBe(true);
  });

  it('once B has stopped scoring, A can delete the match and the deletion syncs', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    at(cloud);
    await a.cycle();
    await a.act(() => expect(canEditMatchNow(M)).toBe(false));
    await b.act((e) => releaseMatch(e, T1, M));
    cloud.clock.tick(2000);
    at(cloud);
    await a.cycle();
    await a.act(() => deleteMatchAsTheScreenDoes());
    await a.cycle();
    expect(cloud.record(T1, 'match', M)?.deleted).toBe(true);
    await b.cycle();
    expect(b.data.matches.some((m) => m.id === M)).toBe(false);
  });

  it('a hold that has run out (B closed the app) no longer stands in the way', async () => {
    const { cloud, a, b } = await twoManagers();
    await b.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    at(cloud);
    await a.cycle();
    cloud.clock.tick(16 * 60_000);
    at(cloud);
    await a.act(() => {
      expect(heldMatchesNow([M])).toEqual([]);
      expect(canEditMatchNow(M)).toBe(true);
    });
  });

  it('a viewer may never delete; a match that is gone can’t be edited', async () => {
    const { cloud, a } = await twoManagers();
    const viewer = new TestDevice(cloud, 'dev-v');
    await viewer.signIn('vera@example.test');
    const invite = await a.act((e) => createInvite(e, T1, 'player', 7));
    if (!invite.ok) throw new Error('no invite');
    await viewer.act((e) => joinTeam(e, invite.value.code));
    await viewer.cycle();
    at(cloud);
    await viewer.act(() => {
      expect(canEditMatchNow(M)).toBe(false);
      expect(canEditMatchNow('no-such-match')).toBe(false);
    });
  });
});

describe('an import while a shared team’s picture is still to be downloaded (audit L31)', () => {
  /** B (a second manager device) has t1, but the download of p1's picture keeps failing. */
  async function pictureWaiting() {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1(true));
    a.photos = { ph2: PHOTO, ph3: PHOTO };
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    const backup = await a.act(() => transferSnapshot());
    const download = b.backend.downloadPhoto.bind(b.backend);
    b.backend.downloadPhoto = async (teamId, id) => {
      if (id === 'ph2') throw new BackendError('unknown', 'storage');
      return download(teamId, id);
    };
    await b.act((e) => downloadTeams(e, [T1]));
    expect(b.photos).toEqual({ ph3: PHOTO });
    return { cloud, a, b, backup, repair: () => (b.backend.downloadPhoto = download) };
  }

  /** The import as Settings → Import does it (`useImport`): read, merge, write in one step. */
  const importInto = (
    d: TestDevice,
    file: Parameters<typeof importWithSharedTeams>[1],
    mode: 'merge' | 'replace',
  ) =>
    d.act(() => {
      const store = useAppStore.getState();
      const shared = sharedTeamsOf(store.sync.teams, store.teams);
      const result = importWithSharedTeams(transferSnapshotNow(), file, mode, shared);
      if (result.ok) {
        store.replaceAll(result.data);
        useAppStore.getState().selectProfile(PROFILE.id);
      }
      return result;
    });

  /** A file with one local team that has nothing to do with the shared one. */
  const otherFile = (): Parameters<typeof importWithSharedTeams>[1] => ({
    profiles: [PROFILE],
    teams: [{ id: 'local-1', profileId: PROFILE.id, name: 'Juniors', createdAt: '2026-01-01' }],
    players: [],
    matches: [],
    presets: [],
    seasons: [],
    opponents: [],
    photos: [],
  });

  it.each(['merge', 'replace'] as const)(
    '%s works; the picture arrives later as before',
    async (mode) => {
      const { cloud, a, b, repair } = await pictureWaiting();
      const result = await importInto(b, otherFile(), mode);
      // Before: Merge said "conflict" and Replace was refused, for any file.
      expect(result.ok).toBe(true);
      expect(b.data.teams.map((t) => t.id).sort()).toEqual(['local-1', T1]);
      await b.act(() => prunePhotos());
      expect(b.data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
      expect(b.photos).toEqual({ ph3: PHOTO });
      // Nothing of the import is pushed as a change of the shared team.
      cloud.clock.tick(60_000);
      await b.cycle();
      expect(b.runtime.status.pending).toBe(0);
      expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ photoId: 'ph2' });
      repair();
      await b.cycle();
      expect(b.photos.ph2).toBe(PHOTO);
      await a.cycle();
      expect(a.data.players.find((p) => p.id === 'p1')?.photoId).toBe('ph2');
    },
  );

  it('a backup that holds the picture brings it back with the import', async () => {
    const { b, backup } = await pictureWaiting();
    const result = await importInto(b, backup, 'merge');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.photos.find((p) => p.id === 'ph2')?.dataUri).toBe(PHOTO);
  });
});
