/**
 * v10 audit (docs/AUDIT_V10.md M3, M4): records that can't be saved to the cloud as they are.
 *
 * M3 — a record this app itself refuses when it pulls it (a name over 200 characters, another
 * text over 1000) used to be pushed all the same: it synced to nobody ("records skipped" on the
 * other devices, nothing on the device that had it), and as the team's own record it kept the
 * team from being downloaded at all. Now it isn't sent, and its device says so.
 *
 * M4 — a record the server refuses (an id over 200 characters, as opponents upgraded from old
 * data with long non-Latin names have; a NUL character; a payload over 64 kB) made
 * `push_records` refuse the whole batch, every cycle: nothing of the team was saved any more,
 * with only "Something went wrong". Now the batch is tried again in halves until the refused
 * record is found; that one waits (remembered for the app run), the rest is pushed.
 *
 * In both cases new records below a waiting new record wait with it: pushed without their
 * parent, the other devices would skip them as orphans and never pull them again.
 */
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Match, Opponent, Player, Season, SetEvent } from '@/domain/types';
import { setPhoto, useAppStore, type AppState } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { BackendError } from '../errors';
import { downloadTeams, uploadTeams } from '../teamCommands';

const T1 = 't1';
const LONG = 'x'.repeat(250);
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const OTHER = 'data:image/jpeg;base64,/9j/AAAA';

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

const TEAM_NAME = t1().teams[0].name;

/** Two devices of one manager account sharing t1, both in sync. */
async function inSync(photos = false) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1(photos));
  if (photos) a.photos = { ph2: PHOTO, ph3: PHOTO };
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  await b.act((e) => downloadTeams(e, [T1]));
  cloud.clock.tick(60_000);
  await a.cycle();
  await b.cycle();
  return { cloud, a, b };
}

const records = (d: TestDevice) => {
  const slice = teamSlice(d.data, T1);
  return slice
    ? Object.fromEntries([...sliceToRecords(slice)].sort(([x], [y]) => x.localeCompare(y)))
    : {};
};

const editPlayer = (d: TestDevice, id: string, patch: Partial<Player>) =>
  d.edit((s) => ({ players: s.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

const player = (d: TestDevice, id: string) => d.data.players.find((p) => p.id === id);
const cloudPayload = (cloud: FakeCloud, kind: PushItem['kind'], id: string) =>
  cloud.record(T1, kind, id)?.payload as Record<string, unknown> | undefined;
const unsent = (d: TestDevice) => d.runtime.notices.filter((n) => n.kind === 'unsent');
const skipped = (d: TestDevice) => d.runtime.notices.filter((n) => n.kind === 'skipped');

/** Logs the record keys of every push call of this device. */
function watchPushes(d: TestDevice): string[][] {
  const pushed: string[][] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    pushed.push(items.map((i) => `${i.kind}:${i.id}`));
    return push(teamId, deviceId, items);
  };
  return pushed;
}

/** A new season with an opponent and a match (one set) in it, as the forms would add them. */
function newSeason(s: AppState, name: string, opponentId = 'ox'): Partial<AppState> {
  const season: Season = { ...s.seasons[0], id: 'sx', teamId: T1, name };
  const opponent: Opponent = { ...s.opponents[0], id: opponentId, seasonId: 'sx', name: 'New VC' };
  const old = s.matches.find((m) => m.id === 'm2') as Match;
  const match: Match = {
    ...old,
    id: 'mx',
    seasonId: 'sx',
    opponentId,
    opponent: 'New VC',
    sets: old.sets.map((x) => ({ ...x, events: [] })),
  };
  return {
    seasons: [...s.seasons, season],
    opponents: [...s.opponents, opponent],
    matches: [...s.matches, match],
  };
}

/** An opponent id as old data upgraded to seasons has it for a long non-Latin name. */
const LONG_ID = `opp-s1-${'%D0%B0'.repeat(40)}`;

/** An opponent the server can't store (its id is over 200 characters), with a match. */
function longIdOpponent(s: AppState): Partial<AppState> {
  const opponent: Opponent = { ...s.opponents[0], id: LONG_ID, seasonId: 's1', name: 'Динамо' };
  const old = s.matches.find((m) => m.id === 'm2') as Match;
  const match: Match = {
    ...old,
    id: 'mb',
    seasonId: 's1',
    opponentId: LONG_ID,
    opponent: 'Динамо',
    sets: old.sets.map((x) => ({ ...x, events: [] })),
  };
  return { opponents: [...s.opponents, opponent], matches: [...s.matches, match] };
}

describe('a record this app couldn’t read back itself (audit M3)', () => {
  it('isn’t pushed; its device is told; everything else syncs', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    const before = cloudPayload(cloud, 'player', 'p2')?.firstName;
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p2')?.firstName).toBe(before);
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(unsent(a)).toEqual([
      {
        kind: 'unsent',
        teamId: T1,
        teamName: TEAM_NAME,
        count: 1,
        label: `${'x'.repeat(40)}…`,
        reason: 'tooLong',
      },
    ]);
    // Still on the device, still counted as waiting.
    expect(player(a, 'p2')?.firstName).toBe(LONG);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 1 });
    // The other device isn't handed a record it has to skip.
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(player(b, 'p3')?.firstName).toBe('Fine');
    expect(skipped(b)).toEqual([]);

    // The name is shortened: it syncs, and the notice is taken back.
    await editPlayer(a, 'p2', { firstName: 'Short' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p2')?.firstName).toBe('Short');
    expect(unsent(a)).toEqual([]);
    expect(a.runtime.status.pending).toBe(0);
    await b.cycle();
    expect(player(b, 'p2')?.firstName).toBe('Short');
  });

  it('a record that is damaged in another way is held too, and the notice says so', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    // Not a long text: a field of the wrong kind (as old or hand-edited data can have).
    await editPlayer(a, 'p2', { positions: 'OH' as never });
    const before = cloudPayload(cloud, 'player', 'p2')?.positions;
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p2')?.positions).toEqual(before);
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'invalid' })]);
  });

  it('is said while offline too, and only once', async () => {
    const { cloud, a } = await inSync();
    cloud.fail = 'offline';
    await editPlayer(a, 'p2', { lastName: LONG });
    await a.cycle();
    await a.act((e) => e.syncNow());
    // Offline, the push isn't reached: the notice comes with the first push.
    cloud.fail = null;
    await a.act((e) => e.syncNow());
    await a.cycle();
    await a.cycle();
    expect(unsent(a)).toHaveLength(1);
  });

  it('a new team whose own record can’t be sent uploads nothing until it can', async () => {
    const cloud = new FakeCloud();
    const data = t1();
    const a = new TestDevice(cloud, 'dev-a', {
      ...data,
      teams: [{ ...data.teams[0], name: LONG }],
    });
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    // Before, everything but a readable team record was in the cloud: no device could
    // download the team, and each tried again every minute.
    expect(cloud.teams.get(T1)?.records.size).toBe(0);
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'tooLong', count: 1 })]);
    expect(a.runtime.status.pending).toBe(22);
    await b.act((e) => downloadTeams(e, [T1]));
    expect(b.data.teams).toEqual([]);

    cloud.clock.tick(60_000);
    await a.edit((s) => ({ teams: s.teams.map((t) => ({ ...t, name: 'U18' })) }));
    await a.cycle();
    expect(cloud.teams.get(T1)?.records.size).toBe(22);
    expect(unsent(a)).toEqual([]);
    expect(a.runtime.status.pending).toBe(0);
    await b.cycle();
    expect(b.data.teams.map((t) => t.name)).toEqual(['U18']);
    expect(records(b)).toEqual(records(a));
  });

  it('what belongs to a new season that waits waits with it, and arrives with it', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit((s) => newSeason(s, LONG));
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    await a.cycle();
    expect(cloud.record(T1, 'season', 'sx')).toBeUndefined();
    expect(cloud.record(T1, 'opponent', 'ox')).toBeUndefined();
    expect(cloud.record(T1, 'match', 'mx')).toBeUndefined();
    expect(cloud.record(T1, 'set', 'mx/1')).toBeUndefined();
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'tooLong' })]);
    expect(a.runtime.status.pending).toBe(4);
    // The other device syncs meanwhile; its pull cursor moves on.
    for (let i = 0; i < 2; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
    }
    expect(skipped(b)).toEqual([]);

    await a.edit((s) => ({
      seasons: s.seasons.map((x) => (x.id === 'sx' ? { ...x, name: 'Spring Cup' } : x)),
    }));
    await a.cycle();
    cloud.clock.tick(60_000);
    await b.cycle();
    // Pushed without its season, the match would have been skipped on B for good.
    expect(b.data.matches.some((m) => m.id === 'mx')).toBe(true);
    expect(b.data.opponents.some((o) => o.id === 'ox')).toBe(true);
    expect(records(b)).toEqual(records(a));
    expect(a.runtime.status.pending).toBe(0);
  });

  it('a match record that waits doesn’t keep its sets from syncing (live scoring goes on)', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    const rally: SetEvent = { type: 'point', winner: 'us' };
    // The opponent of m2 gets a name that is too long (as an import can bring it): the
    // opponent's record and the match's, which shows the same name, can't be sent.
    await a.act(() => useAppStore.getState().renameOpponent('o3', LONG));
    await a.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'm2'
          ? { ...m, sets: m.sets.map((x) => ({ ...x, events: [...x.events, rally] })) }
          : m,
      ),
    }));
    await a.cycle();
    const set = cloudPayload(cloud, 'set', 'm2/1') as { events: SetEvent[] };
    expect(set.events[set.events.length - 1]).toEqual(rally);
    expect(cloudPayload(cloud, 'match', 'm2')?.opponent).toBe('Cup Team');
    expect(cloudPayload(cloud, 'opponent', 'o3')?.name).toBe('Cup Team');
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 2, reason: 'tooLong' })]);
    expect(a.runtime.status.pending).toBe(2);
    cloud.clock.tick(60_000);
    await b.cycle();
    const onB = b.data.matches.find((m) => m.id === 'm2')?.sets[0].events ?? [];
    expect(onB[onB.length - 1]).toEqual(rally);
  });

  it('a player that waits keeps the picture its cloud record still shows', async () => {
    const { cloud, a, b } = await inSync(true);
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(true);
    cloud.clock.tick(60_000);
    await a.act(async () => {
      await setPhoto('ph-new', OTHER);
      useAppStore.getState().updatePlayer('p1', { photoId: 'ph-new', lastName: LONG });
    });
    await a.cycle();
    await a.cycle();
    // The record in the cloud still points at the old picture: it must not be cleaned up.
    expect(cloudPayload(cloud, 'player', 'p1')?.photoId).toBe('ph2');
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(true);
    expect(cloud.photos.has(`${T1}/ph-new`)).toBe(false);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.photos.ph2).toBe(PHOTO);

    await editPlayer(a, 'p1', { lastName: 'Short' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p1')?.photoId).toBe('ph-new');
    expect(cloud.photos.has(`${T1}/ph-new`)).toBe(true);
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(false);
  });
});

describe('a record the server refuses (audit M4)', () => {
  it('no longer blocks the team’s push: it waits with what is below it, the rest goes', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    await a.edit((s) => ({
      presets: s.presets.map((p) => (p.kind === 'preset' ? { ...p, name: 'Renamed' } : p)),
    }));
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(cloudPayload(cloud, 'preset', 'ps2')?.name).toBe('Renamed');
    expect(cloud.record(T1, 'opponent', LONG_ID)).toBeUndefined();
    expect(cloud.record(T1, 'match', 'mb')).toBeUndefined();
    expect(cloud.record(T1, 'set', 'mb/1')).toBeUndefined();
    expect(unsent(a)).toEqual([
      {
        kind: 'unsent',
        teamId: T1,
        teamName: TEAM_NAME,
        count: 1,
        label: 'Динамо',
        reason: 'refused',
      },
    ]);
    // Not an error state: the opponent, its match and the match's set wait.
    expect(a.runtime.status).toMatchObject({ phase: 'synced', error: null, pending: 3 });
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(player(b, 'p3')?.firstName).toBe('Fine');
    expect(skipped(b)).toEqual([]);
    expect(b.data.matches.some((m) => m.id === 'mb')).toBe(false);
  });

  it('isn’t sent again every cycle, but later changes still go', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await a.cycle();
    const pushed = watchPushes(a);
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await a.cycle();
    }
    expect(pushed).toEqual([]);
    await editPlayer(a, 'p4', { firstName: 'Later' });
    await a.cycle();
    expect(pushed).toEqual([['player:p4']]);
    expect(cloudPayload(cloud, 'player', 'p4')?.firstName).toBe('Later');
    expect(unsent(a)).toHaveLength(1);
  });

  it('is tried once more after an app restart, and again when it has changed', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await a.cycle();
    const pushed = watchPushes(a);
    a.engine.refused.clear(); // what an app restart forgets
    await a.cycle();
    expect(pushed).toEqual([
      [`opponent:${LONG_ID}`, 'match:mb', 'set:mb/1'],
      [`opponent:${LONG_ID}`],
    ]);
    pushed.length = 0;
    await a.cycle();
    expect(pushed).toEqual([]);
    // The record changes (here: its name; the id stays too long): one more try.
    await a.edit((s) => ({
      opponents: s.opponents.map((o) => (o.id === LONG_ID ? { ...o, name: 'Dinamo' } : o)),
    }));
    await a.cycle();
    expect(pushed.flat()).toContain(`opponent:${LONG_ID}`);
    expect(cloud.record(T1, 'opponent', LONG_ID)).toBeUndefined();
  });

  it('a character the database can’t store: the others go; fixed, the record syncs', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: 'Na\u0000me' });
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(cloudPayload(cloud, 'player', 'p2')?.firstName).not.toBe('Na\u0000me');
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'refused', count: 1 })]);
    await editPlayer(a, 'p2', { firstName: 'Name' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p2')?.firstName).toBe('Name');
    expect(unsent(a)).toEqual([]);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(player(b, 'p2')?.firstName).toBe('Name');
  });

  it('a set that is too large for the server waits alone; its match stays in sync', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    const rally: SetEvent = { type: 'point', winner: 'us', at: '2026-11-26T10:00:00.000Z' };
    const home = a.data.matches.find((m) => m.id === 'm2')?.home;
    await a.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'm2'
          ? {
              ...m,
              home: !m.home,
              sets: m.sets.map((x) => ({
                ...x,
                events: Array.from({ length: 1500 }, () => rally),
              })),
            }
          : m,
      ),
    }));
    const pushed = watchPushes(a);
    await a.cycle();
    // Refused together, then each record alone: the match's own change is saved.
    expect(pushed).toEqual([['match:m2', 'set:m2/1'], ['match:m2'], ['set:m2/1']]);
    expect(cloudPayload(cloud, 'match', 'm2')?.home).toBe(!home);
    const stored = cloudPayload(cloud, 'set', 'm2/1') as { events: unknown[] };
    expect(stored.events.length).toBeLessThan(1500);
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'refused', count: 1 })]);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 1 });
    // Not sent again; a later change of the match still goes, the set keeps waiting.
    pushed.length = 0;
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(pushed).toEqual([]);
    await a.edit((s) => ({
      matches: s.matches.map((m) => (m.id === 'm2' ? { ...m, date: '2026-12-01' } : m)),
    }));
    await a.cycle();
    expect(pushed).toEqual([['match:m2']]);
    expect(cloudPayload(cloud, 'match', 'm2')?.date).toBe('2026-12-01');
  });

  it('finding it among many records takes a few requests, not one per record', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      ...longIdOpponent(s),
      players: [
        ...s.players,
        ...Array.from({ length: 60 }, (_, i) => ({
          ...s.players[0],
          id: `extra-${i}`,
          number: 20 + i,
          firstName: `Extra ${i}`,
        })),
      ],
    }));
    const pushed = watchPushes(a);
    await a.cycle();
    for (let i = 0; i < 60; i += 1) expect(cloud.record(T1, 'player', `extra-${i}`)).toBeDefined();
    expect(cloud.record(T1, 'opponent', LONG_ID)).toBeUndefined();
    expect(pushed.length).toBeLessThanOrEqual(16);
    expect(a.runtime.status.pending).toBe(3);
  });

  it('two refused records in one push are both found', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await editPlayer(a, 'p2', { firstName: 'Na\u0000me' });
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    await editPlayer(a, 'p5', { firstName: 'Also fine' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(cloudPayload(cloud, 'player', 'p5')?.firstName).toBe('Also fine');
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'refused', count: 2 })]);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 4 });
    expect(a.engine.refused.get(T1)?.size).toBe(2);
  });

  it('a push refused for another reason isn’t taken apart (the team is full)', async () => {
    const { a } = await inSync();
    // Not the content of a record: the team's storage limit (VL007).
    let attempts = 0;
    a.backend.pushRecords = async () => {
      attempts += 1;
      throw new BackendError('tooMany', 'VL007');
    };
    await editPlayer(a, 'p3', { firstName: 'Mine' });
    await editPlayer(a, 'p4', { firstName: 'Mine too' });
    await a.cycle();
    expect(attempts).toBe(1);
    expect(a.runtime.status).toMatchObject({ phase: 'error', error: 'tooMany', pending: 2 });
    expect(a.engine.refused.size).toBe(0);
    expect(unsent(a)).toEqual([]);
  });
});
