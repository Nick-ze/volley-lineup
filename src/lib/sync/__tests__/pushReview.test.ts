/**
 * v10 audit, second chat: the independent review of the push fixes (M3, M4, M5, M12) and what it
 * found — each sequence as a test (docs/AUDIT_V10.md, "Engine fix log", PR 2).
 *
 * 1. Holding a record back (M3, M4) and taking a push apart (M4, M5) must never let the deletion
 *    of a season or an opponent reach the other devices before the change that moves a match
 *    away from it: they delete everything below a deleted season or opponent.
 * 2. A team's full photo folder must still be cleaned up when a record waits for its upload.
 * 3. The notice about records that can't be synced follows what waits, and goes with the team.
 * 4. Half of an emoji in a text: the database refuses the whole request (SQLSTATE 22P02).
 * 5. Cases the first tests of these fixes left open (found by changing the code and seeing no
 *    test fail).
 */
import { PUSH_LIMITS } from '@/domain/syncChanges';
import { sliceToRecords, teamSlice, type TeamData } from '@/domain/syncRecords';
import type { Match, Opponent, Player, Season, SetEvent } from '@/domain/types';
import { setPhoto, useAppStore, useSyncRuntime, type AppState } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { PROFILE, TestDevice } from '@/test-utils/syncDevice';

import type { PushItem } from '../backend';
import { BackendError } from '../errors';
import { createInvite, removeMember, setMemberRole } from '../memberCommands';
import { downloadTeams, joinTeam, unlinkTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const LONG = 'x'.repeat(250);
const PHOTO = 'data:image/png;base64,iVBORw0KGgo=';
const OTHER = 'data:image/jpeg;base64,/9j/AAAA';
/** What is left of an emoji that was cut in the middle. */
const HALF_EMOJI = '🏐'[0];

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

/** Two devices of one manager account sharing t1 (or `data`), both in sync. */
async function inSync(photos = false, data: TeamData = t1(photos)) {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', data);
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

const cloudPayload = (cloud: FakeCloud, kind: PushItem['kind'], id: string) =>
  cloud.record(T1, kind, id)?.payload as Record<string, unknown> | undefined;
const unsent = (d: TestDevice) => d.runtime.notices.filter((n) => n.kind === 'unsent');
const matchIds = (d: TestDevice) => d.data.matches.map((m) => m.id);
const rallies = (d: TestDevice, matchId: string) =>
  d.data.matches.find((m) => m.id === matchId)?.sets[0].events.length;

const itemKeys = (items: readonly PushItem[]) =>
  items.map((i) => `${i.kind}:${i.id}${i.deleted ? ' (del)' : ''}`);

/** Logs the record keys of every push request of this device. */
function watchPushes(d: TestDevice): string[][] {
  const pushed: string[][] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    pushed.push(itemKeys(items));
    return push(teamId, deviceId, items);
  };
  return pushed;
}

/**
 * Lets `other` sync right before every push request of `d` — whatever a push sends in several
 * requests, another device can pull between any two of them. `check` runs after each such sync.
 */
function pullBeforeEveryRequest(d: TestDevice, other: TestDevice, check: () => void): string[][] {
  const pushed: string[][] = [];
  const push = d.backend.pushRecords.bind(d.backend);
  const self = d as unknown as { save(): void; load(): void };
  d.backend.pushRecords = async (teamId: string, deviceId: string, items: readonly PushItem[]) => {
    pushed.push(itemKeys(items));
    self.save();
    await other.cycle();
    check();
    self.load();
    return push(teamId, deviceId, items);
  };
  return pushed;
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

/** The match form: m1 (played, opponent o1) gets another opponent; o1, now unused, is deleted. */
const moveM1AndDeleteO1 = (d: TestDevice, opponentId: string, opponent: string) =>
  d.act(() => {
    const store = useAppStore.getState();
    store.updateMatch('m1', { opponentId, opponent });
    store.deleteOpponent('o1');
  });

const rally: SetEvent = { type: 'point', winner: 'us' };
const stampedRally: SetEvent = { type: 'point', winner: 'us', at: '2026-11-26T10:00:00.000Z' };

describe('a deleted season or opponent and the match that moved away from it', () => {
  it('the move waits (its new opponent can’t be pushed): the old opponent isn’t deleted elsewhere', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await a.cycle();
    expect(cloud.record(T1, 'opponent', LONG_ID)).toBeUndefined();
    expect(rallies(b, 'm1')).toBe(10);

    cloud.clock.tick(60_000);
    await moveM1AndDeleteO1(a, LONG_ID, 'Динамо');
    expect(a.data.opponents.some((o) => o.id === 'o1')).toBe(false);
    const pushed = watchPushes(a);
    await a.cycle();
    // Neither the move (below an opponent that isn't pushed) nor the deletion is sent.
    expect(pushed).toEqual([]);
    expect(cloud.record(T1, 'opponent', 'o1')?.deleted).toBe(false);
    expect(cloudPayload(cloud, 'match', 'm1')?.opponentId).toBe('o1');
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(matchIds(b)).toEqual(['m1', 'm2']);
    expect(rallies(b, 'm1')).toBe(10);

    // The match gets an opponent the cloud has: the move goes, and the deletion after it.
    cloud.clock.tick(60_000);
    await a.act(() =>
      useAppStore.getState().updateMatch('m1', { opponentId: 'o2', opponent: 'Upcoming VC' }),
    );
    await a.cycle();
    expect(pushed).toEqual([['match:m1', 'opponent:o1 (del)']]);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.opponents.some((o) => o.id === 'o1')).toBe(false);
    expect(records(b)['match:m1']).toEqual(records(a)['match:m1']);
    expect(rallies(b, 'm1')).toBe(10);
  });

  it('the same when the push that carries both is the one that first meets the refusal', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit(longIdOpponent);
    await moveM1AndDeleteO1(a, LONG_ID, 'Динамо');
    await a.cycle();
    // Whatever the requests were until the refused opponent was found: no deletion got through.
    expect(cloud.record(T1, 'opponent', 'o1')?.deleted).toBe(false);
    expect(cloudPayload(cloud, 'match', 'm1')?.opponentId).toBe('o1');
    expect(a.engine.refused.get(T1)?.size).toBe(1);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(matchIds(b)).toEqual(['m1', 'm2']);
    expect(rallies(b, 'm1')).toBe(10);
  });

  it('another device’s opponent merged into one that can’t be pushed: its match stays there', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    // A: the opponent the server can't store (the known limit of DECISIONS #322), with a match.
    await a.edit(longIdOpponent);
    await a.cycle();
    // B doesn't have that opponent: its manager adds it by name and scores a match against it.
    cloud.clock.tick(60_000);
    await b.edit((s) => {
      const opponent: Opponent = {
        id: 'ob',
        seasonId: 's1',
        name: 'Динамо',
        createdAt: '2026-11-26T10:05:00.000Z',
      };
      const old = s.matches.find((m) => m.id === 'm2') as Match;
      const match: Match = {
        ...old,
        id: 'mB',
        seasonId: 's1',
        opponentId: 'ob',
        opponent: 'Динамо',
        sets: old.sets.map((x) => ({ ...x, events: [rally, rally, rally] })),
      };
      return { opponents: [...s.opponents, opponent], matches: [...s.matches, match] };
    });
    await b.cycle();
    expect(cloud.record(T1, 'match', 'mB')).toBeDefined();

    // A pulls: the two opponents of one name become one — A's own, older one (it can't be
    // pushed). B's opponent goes on A; that deletion must wait like the match's move.
    cloud.clock.tick(60_000);
    const pushed = watchPushes(a);
    await a.cycle();
    expect(a.data.matches.find((m) => m.id === 'mB')?.opponentId).toBe(LONG_ID);
    expect(pushed.flat()).not.toContain('opponent:ob (del)');
    expect(cloud.record(T1, 'opponent', 'ob')?.deleted).toBe(false);
    for (let i = 0; i < 2; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
      await a.cycle();
    }
    expect(matchIds(b)).toContain('mB');
    expect(rallies(b, 'mB')).toBe(3);
    expect(rallies(a, 'mB')).toBe(3);
  });

  it('a match moved into a new season that waits: the old season stays until the move arrives', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    // m2 (season s2, opponent o3) moves into a new season whose name is too long; s2 goes.
    await a.edit((s) => {
      const season: Season = { ...s.seasons[0], id: 'sx', teamId: T1, name: LONG };
      const opponent: Opponent = { ...s.opponents[0], id: 'ox', seasonId: 'sx', name: 'New VC' };
      return {
        seasons: [...s.seasons.filter((x) => x.id !== 's2'), season],
        opponents: [...s.opponents.filter((o) => o.id !== 'o3'), opponent],
        matches: s.matches.map((m) =>
          m.id === 'm2' ? { ...m, seasonId: 'sx', opponentId: 'ox', opponent: 'New VC' } : m,
        ),
      };
    });
    const pushed = watchPushes(a);
    await a.cycle();
    expect(pushed).toEqual([]);
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'tooLong' })]);
    expect(cloud.record(T1, 'season', 's2')?.deleted).toBe(false);
    expect(cloud.record(T1, 'opponent', 'o3')?.deleted).toBe(false);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(matchIds(b)).toEqual(['m1', 'm2']);

    // Shortened, everything arrives: the new season with what is in it, then the deletions.
    await a.edit((s) => ({
      seasons: s.seasons.map((x) => (x.id === 'sx' ? { ...x, name: 'Spring' } : x)),
    }));
    await a.cycle();
    expect(pushed).toEqual([
      ['season:sx', 'opponent:ox', 'match:m2', 'season:s2 (del)', 'opponent:o3 (del)'],
    ]);
    expect(unsent(a)).toEqual([]);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(records(b)).toEqual(records(a));
    expect(b.data.matches.find((m) => m.id === 'm2')).toMatchObject({ seasonId: 'sx' });
    expect(b.data.seasons.some((x) => x.id === 's2')).toBe(false);
  });

  it('a push taken apart after a refusal (M4): a device that pulls in between keeps the match', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await moveM1AndDeleteO1(a, 'o2', 'Upcoming VC');
    // Unrelated: one player the server refuses (a NUL character), so the batch is taken apart.
    await editPlayer(a, 'p2', { firstName: 'Na\u0000me' });
    const pushed = pullBeforeEveryRequest(a, b, () => expect(matchIds(b)).toEqual(['m1', 'm2']));
    await a.cycle();
    expect(pushed.length).toBeGreaterThan(1);
    // The deletion never travels before the move.
    const sent = pushed.filter((keys) => !keys.includes('player:p2')).flat();
    expect(sent).toEqual(['match:m1', 'opponent:o1 (del)']);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(matchIds(b)).toEqual(['m1', 'm2']);
    expect(records(b)['match:m1']).toEqual(records(a)['match:m1']);
    expect(rallies(b, 'm1')).toBe(10);
    expect(b.data.opponents.some((o) => o.id === 'o1')).toBe(false);
  });

  it('a push in small parts (M5): the move and the deletion still travel in one request', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await moveM1AndDeleteO1(a, 'o2', 'Upcoming VC');
    await editPlayer(a, 'p2', { firstName: 'Also changed' });
    // One record per request, as on a connection so slow that little fits into one.
    const limit: { count: number } = a.engine.pushLimit;
    limit.count = 1;
    const pushed = pullBeforeEveryRequest(a, b, () => expect(matchIds(b)).toEqual(['m1', 'm2']));
    await a.cycle();
    expect(pushed).toEqual([['match:m1', 'opponent:o1 (del)'], ['player:p2']]);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(records(b)).toEqual(records(a));
    expect(rallies(b, 'm1')).toBe(10);
  });
});

describe('a season or opponent deleted and entered again under the same name', () => {
  // Found when the first fix for the cases above sent such deletions last: a manager device
  // that pulls between "new opponent" and "old opponent deleted" has two of one name, merges
  // the new one into the old one and pushes the new one's deletion — gone for everyone.
  const manyPlayers = (s: AppState, n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...s.players[0], id: `extra-${i}`, number: 20 + i }));
  const has = (d: TestDevice, matchId: string) => d.data.matches.some((m) => m.id === matchId);

  it('an opponent, with a new match, in a push of several requests', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    let matchId = '';
    let opponentId = '';
    await a.act(() => {
      const store = useAppStore.getState();
      store.deleteOpponent('o2'); // "Upcoming VC": no match yet, so it can be deleted
      const again = store.addOpponent('s1', 'Upcoming VC');
      opponentId = again.id;
      matchId = store.addMatch({
        teamId: T1,
        seasonId: 's1',
        opponentId: again.id,
        opponent: 'Upcoming VC',
        date: '2026-12-10',
        home: true,
      }).id;
      // Enough other changes for a second request (over 100 records).
      useAppStore.setState((s) => ({ players: [...s.players, ...manyPlayers(s, 120)] }));
    });
    const pushed = pullBeforeEveryRequest(a, b, () => undefined);
    await a.cycle();
    expect(pushed.length).toBeGreaterThan(1);
    // The new opponent and the old one's deletion: the same request.
    const request = (key: string) => pushed.findIndex((keys) => keys.includes(key));
    expect(request(`opponent:${opponentId}`)).toBe(request('opponent:o2 (del)'));
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
      await a.cycle();
    }
    expect(has(a, matchId)).toBe(true);
    expect(has(b, matchId)).toBe(true);
    expect(cloud.record(T1, 'opponent', opponentId)?.deleted).toBe(false);
    expect(records(b)).toEqual(records(a));
  });

  it('a season with everything in it', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    let matchId = '';
    let seasonId = '';
    await a.act(() => {
      const store = useAppStore.getState();
      store.deleteSeason('s2'); // "Winter Cup" with its opponent and match
      const season = store.addSeason({ teamId: T1, name: 'Winter Cup', kind: 'tournament' });
      seasonId = season.id;
      const opponent = store.addOpponent(season.id, 'Cup Team B');
      matchId = store.addMatch({
        teamId: T1,
        seasonId: season.id,
        opponentId: opponent.id,
        opponent: 'Cup Team B',
        date: '2027-01-10',
        home: true,
      }).id;
      useAppStore.setState((s) => ({ players: [...s.players, ...manyPlayers(s, 120)] }));
    });
    const pushed = pullBeforeEveryRequest(a, b, () => undefined);
    await a.cycle();
    const request = (key: string) => pushed.findIndex((keys) => keys.includes(key));
    expect(request(`season:${seasonId}`)).toBe(request('season:s2 (del)'));
    for (let i = 0; i < 3; i += 1) {
      cloud.clock.tick(60_000);
      await b.cycle();
      await a.cycle();
    }
    expect(has(a, matchId)).toBe(true);
    expect(has(b, matchId)).toBe(true);
    expect(a.data.seasons.map((x) => x.id)).toContain(seasonId);
    expect(records(b)).toEqual(records(a));
  });

  it('when one of those records is refused: it waits, the others still go together', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    // A new opponent with a character the database can't store, and a season that goes: one
    // group, refused as a whole, then taken apart to find the record.
    let opponentId = '';
    await a.act(() => {
      const store = useAppStore.getState();
      opponentId = store.addOpponent('s1', 'Na\u0000me').id;
      store.deleteSeason('s2');
    });
    const pushed = watchPushes(a);
    await a.cycle();
    const group = [`opponent:${opponentId}`, 'season:s2 (del)', 'opponent:o3 (del)'];
    const deleted = ['match:m2 (del)', 'set:m2/1 (del)'];
    expect(pushed).toEqual([
      [...group, ...deleted], // refused
      group, // refused: which of them?
      [group[0]], // this one; it waits
      [...group.slice(1), ...deleted], // the rest, the season's and the opponent's deletion together
    ]);
    expect(cloud.record(T1, 'opponent', opponentId)).toBeUndefined();
    expect(cloud.record(T1, 'season', 's2')?.deleted).toBe(true);
    expect(cloud.record(T1, 'opponent', 'o3')?.deleted).toBe(true);
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'refused' })]);
    expect(a.runtime.status.pending).toBe(1);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.seasons.some((x) => x.id === 's2')).toBe(false);
    expect(matchIds(b)).toEqual(['m1']);
  });
});

describe('a season or opponent deleted: what is left after a refusal, in small batches', () => {
  it('the deletions still travel in one request once the refused record is set aside', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    let opponentId = '';
    await a.act(() => {
      const store = useAppStore.getState();
      opponentId = store.addOpponent('s1', 'Na\u0000me').id;
      store.deleteSeason('s2');
    });
    const limit: { count: number } = a.engine.pushLimit;
    limit.count = 1;
    const pushed = watchPushes(a);
    await a.cycle();
    const group = [`opponent:${opponentId}`, 'season:s2 (del)', 'opponent:o3 (del)'];
    expect(pushed).toEqual([
      group, // refused
      [group[0]], // this one; it waits
      group.slice(1),
      ['match:m2 (del)', 'set:m2/1 (del)'],
    ]);
    expect(cloud.record(T1, 'season', 's2')?.deleted).toBe(true);
  });
});

describe('a season or opponent deleted: a large group on a slow connection (M5)', () => {
  const aborted = () =>
    Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });

  /** o2 with 150 matches the cloud has, and an empty opponent; o2 is renamed, the empty one goes. */
  async function largeGroup() {
    const data = t1();
    const old = data.matches.find((m) => m.id === 'm2') as Match;
    const many: Match[] = Array.from({ length: 150 }, (_, i) => ({
      ...old,
      id: `mm-${i}`,
      seasonId: 's1',
      opponentId: 'o2',
      opponent: 'Upcoming VC',
      sets: old.sets.map((x) => ({ ...x, events: [] })),
    }));
    const empty: Opponent = {
      id: 'oE',
      seasonId: 's1',
      name: 'Nobody',
      createdAt: '2026-03-01T00:00:00.000Z',
    };
    const devices = await inSync(false, {
      ...data,
      opponents: [...data.opponents, empty],
      matches: [...data.matches, ...many],
    });
    devices.cloud.clock.tick(60_000);
    await devices.a.act(() => {
      const store = useAppStore.getState();
      store.renameOpponent('o2', 'Upcoming Volley'); // changes its 150 matches too
      store.deleteOpponent('oE');
    });
    await editPlayer(devices.a, 'p3', { firstName: 'Fine' });
    return devices;
  }

  it('a push that times out once: the group still travels whole in the next try', async () => {
    const { cloud, a } = await largeGroup();
    const pushed: string[][] = [];
    const push = a.backend.pushRecords.bind(a.backend);
    a.backend.pushRecords = async (
      teamId: string,
      deviceId: string,
      items: readonly PushItem[],
    ) => {
      pushed.push(itemKeys(items));
      if (pushed.length === 1) throw aborted();
      return push(teamId, deviceId, items);
    };
    await a.cycle();
    // More than a batch holds, so the group has a request of its own; it is tried again whole.
    expect(pushed[0]).toHaveLength(152);
    expect(pushed[1]).toEqual(pushed[0]);
    expect(pushed[1][0]).toBe('opponent:o2');
    expect(pushed[1][151]).toBe('opponent:oE (del)');
    expect(pushed[2]).toEqual(['player:p3']);
    expect(pushed).toHaveLength(3);
    expect(a.engine.pushLimit.bytes).toBeLessThan(PUSH_LIMITS.bytes);
    expect(a.runtime.status.pending).toBe(0);
    expect(cloud.record(T1, 'opponent', 'oE')?.deleted).toBe(true);
  });

  it('too slow for the whole group: it goes in parts after all, the deletion last', async () => {
    const { cloud, a } = await largeGroup();
    const sent: string[][] = [];
    const push = a.backend.pushRecords.bind(a.backend);
    a.backend.pushRecords = async (
      teamId: string,
      deviceId: string,
      items: readonly PushItem[],
    ) => {
      // An uplink that gets 20 kB through per request; the group is about 26 kB.
      if (JSON.stringify(items).length > 20_000) throw aborted();
      sent.push(itemKeys(items));
      return push(teamId, deviceId, items);
    };
    // The first sync tries the whole group twice and ends as offline …
    await a.act((e) => e.syncNow());
    expect(a.runtime.status.phase).toBe('offline');
    expect(sent).toEqual([]);
    // … the next one sends it in parts.
    await a.act((e) => e.syncNow());
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 0 });
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(cloudPayload(cloud, 'opponent', 'o2')?.name).toBe('Upcoming Volley');
    expect(cloudPayload(cloud, 'match', 'mm-149')?.opponent).toBe('Upcoming Volley');
    expect(cloud.record(T1, 'opponent', 'oE')?.deleted).toBe(true);
    // In parts, but in order: the deletion after every match's change.
    const all = sent.flat();
    expect(all.indexOf('opponent:oE (del)')).toBeGreaterThan(all.indexOf('match:mm-149'));
    expect(sent.length).toBeGreaterThan(1);
  });
});

describe('a full photo folder', () => {
  /** The storage policy allows 150 photos per team; here the folder is full at `limit`. */
  function fullFolder(d: TestDevice, cloud: FakeCloud, limit: number): void {
    const upload = d.backend.uploadPhoto.bind(d.backend);
    d.backend.uploadPhoto = async (teamId: string, photoId: string, dataUri: string) => {
      if (!cloud.photos.has(`${teamId}/${photoId}`) && cloud.photoCount(teamId) >= limit) {
        throw new BackendError('forbidden', '42501'); // the storage policy's answer
      }
      return upload(teamId, photoId, dataUri);
    };
  }

  it('a replaced picture still gets in: the clean-up makes room although the record waits', async () => {
    const { cloud, a } = await inSync(true);
    expect(cloud.photoCount(T1)).toBe(2);
    fullFolder(a, cloud, 2);
    cloud.clock.tick(60_000);
    await a.act(async () => {
      await setPhoto('ph-new', OTHER);
      useAppStore.getState().updatePlayer('p1', { photoId: 'ph-new', lastName: 'Married' });
    });
    await a.cycle();
    // The upload was refused, so the record waits — but the picture nobody needs here is gone.
    expect(cloudPayload(cloud, 'player', 'p1')?.lastName).not.toBe('Married');
    expect(cloud.photos.has(`${T1}/ph2`)).toBe(false);
    cloud.clock.tick(60_000);
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p1')).toMatchObject({
      lastName: 'Married',
      photoId: 'ph-new',
    });
    expect(cloud.photos.get(`${T1}/ph-new`)).toBe(OTHER);
    expect(a.runtime.status.pending).toBe(0);
  });

  it('a team record that can’t be pushed keeps the picture its cloud record still shows', async () => {
    const { cloud, a } = await inSync(true);
    expect(cloud.photos.has(`${T1}/ph3`)).toBe(true);
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      teams: s.teams.map((t) => ({ ...t, photoId: undefined, name: LONG })),
    }));
    await a.cycle();
    await a.cycle();
    expect(cloudPayload(cloud, 'team', T1)?.photoId).toBe('ph3');
    expect(cloud.photos.has(`${T1}/ph3`)).toBe(true);
  });
});

describe('the notice about records that can’t be synced', () => {
  it('names a record that still waits after the first one was fixed', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await a.cycle();
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'tooLong' })]);
    // A second record can't be sent (the server refuses it).
    await editPlayer(a, 'p3', { firstName: 'Na\u0000me' });
    await a.cycle();
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 2, reason: 'tooLong' })]);
    // The first one is fixed; the second still waits.
    await editPlayer(a, 'p2', { firstName: 'Short' });
    await a.cycle();
    expect(a.runtime.status.pending).toBe(1);
    const lastName = a.data.players.find((p) => p.id === 'p3')?.lastName ?? '';
    expect(unsent(a)).toEqual([
      {
        kind: 'unsent',
        teamId: T1,
        teamName: TEAM_NAME,
        count: 1,
        label: `Na\u0000me ${lastName}`.trim(),
        reason: 'refused',
      },
    ]);
  });

  it('a dismissed notice stays away while nothing changes, and comes back for a new record', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await a.cycle();
    expect(unsent(a)).toHaveLength(1);
    const dismiss = () =>
      a.act(() => {
        useSyncRuntime.setState((r) => ({ notices: r.notices.filter((n) => n.kind !== 'unsent') }));
      });
    await dismiss();
    await a.cycle();
    await a.cycle();
    expect(unsent(a)).toEqual([]);
    await editPlayer(a, 'p3', { lastName: LONG });
    await a.cycle();
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 2, reason: 'tooLong' })]);
    // Fixed, nothing is left to say — and a later record is told about again.
    await editPlayer(a, 'p2', { firstName: 'Short' });
    await editPlayer(a, 'p3', { lastName: 'Short' });
    await a.cycle();
    expect(unsent(a)).toEqual([]);
    await editPlayer(a, 'p2', { firstName: LONG });
    await a.cycle();
    expect(unsent(a)).toHaveLength(1);
  });

  it('goes when the team is no longer synced from this device, with what was remembered', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await editPlayer(a, 'p3', { firstName: 'Na\u0000me' });
    await a.cycle();
    expect(unsent(a)).toHaveLength(1);
    expect(a.engine.refused.get(T1)?.size).toBe(1);
    await a.act((e) => unlinkTeam(e, T1));
    await a.cycle();
    expect(unsent(a)).toEqual([]);
    expect(a.engine.refused.has(T1)).toBe(false);
    expect(a.engine.unsent.has(T1)).toBe(false);
  });

  it('is replaced when only the record’s name or only the reason changes', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    const location = (value: string) =>
      a.edit((s) => ({
        seasons: s.seasons.map((x) => (x.id === 's1' ? { ...x, location: value } : x)),
      }));
    await location('y'.repeat(1001));
    await a.cycle();
    expect(unsent(a)).toEqual([
      expect.objectContaining({ count: 1, reason: 'tooLong', label: '2026/27' }),
    ]);
    // Short enough now, but with a character the cloud refuses: the same record, another reason.
    await location('Ha\u0000lle');
    await a.cycle();
    expect(unsent(a)).toEqual([
      expect.objectContaining({ count: 1, reason: 'refused', label: '2026/27' }),
    ]);
    // Renamed: the same reason, another name.
    await a.edit((s) => ({
      seasons: s.seasons.map((x) => (x.id === 's1' ? { ...x, name: '2026–27' } : x)),
    }));
    await a.cycle();
    expect(unsent(a)).toEqual([
      expect.objectContaining({ count: 1, reason: 'refused', label: '2026–27' }),
    ]);
  });

  it('goes with a team that is gone from the device', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await editPlayer(a, 'p3', { firstName: 'Na\u0000me' });
    await a.cycle();
    expect(unsent(a)).toHaveLength(1);
    // The team disappears from the data while its link is still there (as a link left behind).
    await a.edit(() => ({ teams: [], players: [], seasons: [], opponents: [], matches: [] }));
    await a.cycle();
    expect(a.data.sync.teams[T1]).toBeUndefined();
    expect(unsent(a)).toEqual([]);
    expect(a.engine.refused.has(T1)).toBe(false);
  });

  it('goes when the running app deletes its data ("Delete all data")', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await editPlayer(a, 'p3', { firstName: 'Na\u0000me' });
    await a.cycle();
    jest.useFakeTimers();
    try {
      await a.act(async (engine) => {
        const stop = engine.start(); // the running app: the engine listens to the store
        await jest.advanceTimersByTimeAsync(10);
        const shown = () => useSyncRuntime.getState().notices.filter((n) => n.kind === 'unsent');
        expect(shown()).toHaveLength(1);
        useAppStore.getState().resetAll();
        stop();
        expect(shown()).toEqual([]);
        expect(engine.refused.has(T1)).toBe(false);
        expect(engine.unsent.has(T1)).toBe(false);
      });
    } finally {
      jest.useRealTimers();
    }
  });

  /** Anna (device A) shares t1; Ben joins as a manager on device B and has a record that waits. */
  async function benWaits() {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('ben@example.test');
    await a.act((e) => uploadTeams(e, [T1]));
    await a.cycle();
    const invite = await a.act((e) => createInvite(e, T1, 'manager', 7));
    if (!invite.ok) throw new Error('no invite');
    await b.act((e) => joinTeam(e, invite.value.code));
    await b.cycle();
    await editPlayer(b, 'p2', { firstName: LONG });
    await b.cycle();
    expect(unsent(b)).toHaveLength(1);
    return { cloud, a, b, ben: cloud.userId('ben@example.test') };
  }

  it('goes when this device may no longer edit the team (its changes are undone)', async () => {
    const { a, b, ben } = await benWaits();
    await a.act((e) => setMemberRole(e, T1, ben, 'player'));
    await b.cycle();
    expect(b.runtime.notices.map((n) => n.kind)).toEqual(['demoted']);
    expect(b.engine.unsent.has(T1)).toBe(false);
  });

  it('goes when this account was removed from the team', async () => {
    const { a, b, ben } = await benWaits();
    await a.act((e) => removeMember(e, T1, ben));
    await b.cycle();
    expect(b.runtime.notices.map((n) => n.kind)).toEqual(['removed']);
    expect(b.engine.unsent.has(T1)).toBe(false);
  });
});

describe('half of an emoji in a text', () => {
  it('stays on the device with a notice; the rest goes; made whole, it syncs', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    // A long name cut in the middle of an emoji (as the upgrade of old opponent names can).
    const cut = `${'x'.repeat(59)}${HALF_EMOJI}`;
    await a.edit((s) => ({
      opponents: s.opponents.map((o) => (o.id === 'o2' ? { ...o, name: cut } : o)),
    }));
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    const pushed = watchPushes(a);
    await a.cycle();
    // Not sent at all: the database would refuse the whole request for it.
    expect(pushed).toEqual([['player:p3']]);
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(cloudPayload(cloud, 'opponent', 'o2')?.name).toBe('Upcoming VC');
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'refused' })]);
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 1 });

    await a.edit((s) => ({
      opponents: s.opponents.map((o) => (o.id === 'o2' ? { ...o, name: 'Volleys 🏐' } : o)),
    }));
    await a.cycle();
    expect(unsent(a)).toEqual([]);
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(b.data.opponents.find((o) => o.id === 'o2')?.name).toBe('Volleys 🏐');
  });

  it('the test server refuses it like the database (22P02), should it ever be sent', async () => {
    const { a } = await inSync();
    const item: PushItem = {
      kind: 'opponent',
      id: 'o2',
      at: '2026-11-26T12:00:00.000Z',
      payload: { seasonId: 's1', name: `Cut ${HALF_EMOJI}`, createdAt: '2026-01-02T00:00:00.000Z' },
    };
    await expect(a.backend.pushRecords(T1, 'dev-a', [item])).rejects.toMatchObject({
      raw: '22P02',
    });
  });

  it('a push the server refuses with 22P02 is taken apart like any other refused content', async () => {
    const { cloud, a } = await inSync();
    const push = a.backend.pushRecords.bind(a.backend);
    a.backend.pushRecords = async (
      teamId: string,
      deviceId: string,
      items: readonly PushItem[],
    ) => {
      if (items.some((i) => i.id === 'p2')) throw new BackendError('unknown', '22P02');
      return push(teamId, deviceId, items);
    };
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: 'Unreadable there' });
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    await a.cycle();
    expect(cloudPayload(cloud, 'player', 'p3')?.firstName).toBe('Fine');
    expect(a.runtime.status).toMatchObject({ phase: 'synced', pending: 1 });
    expect(unsent(a)).toEqual([expect.objectContaining({ count: 1, reason: 'refused' })]);
  });
});

describe('cases the first tests left open', () => {
  /** m2 as a match the cloud doesn't have (`id`), its set too large for the server. */
  const tooLarge = (s: AppState, id: string): Match => {
    const old = s.matches.find((m) => m.id === 'm2') as Match;
    return {
      ...old,
      id,
      sets: old.sets.map((x) => ({
        ...x,
        events: Array.from({ length: 1500 }, () => stampedRally),
      })),
    };
  };

  it('a NEW match whose set the server refuses isn’t pushed without it; smaller, both arrive', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit((s) => ({ matches: [...s.matches, tooLarge(s, 'mx')] }));
    const pushed = watchPushes(a);
    await a.cycle();
    expect(pushed).toEqual([['match:mx', 'set:mx/1']]);
    expect(cloud.record(T1, 'match', 'mx')).toBeUndefined();
    expect(cloud.record(T1, 'set', 'mx/1')).toBeUndefined();
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'refused', count: 2 })]);
    await a.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'mx' ? { ...m, sets: m.sets.map((x) => ({ ...x, events: [rally] })) } : m,
      ),
    }));
    await a.cycle();
    cloud.clock.tick(60_000);
    await b.cycle();
    expect(matchIds(b)).toContain('mx');
    expect(records(b)).toEqual(records(a));
  });

  it('a match brought back after its deletion counts as new: not without its refused set', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.act(() => useAppStore.getState().deleteMatch('m2'));
    await a.cycle();
    expect(cloud.record(T1, 'match', 'm2')?.deleted).toBe(true);
    cloud.clock.tick(60_000);
    const back = tooLarge({ matches: t1().matches } as AppState, 'm2');
    await a.edit((s) => ({ matches: [...s.matches, back] }));
    const pushed = watchPushes(a);
    await a.cycle();
    // One request, refused as a whole — the match isn't then tried alone.
    expect(pushed).toEqual([['match:m2', 'set:m2/1']]);
    expect(cloud.record(T1, 'match', 'm2')?.deleted).toBe(true);
    expect(unsent(a)).toEqual([expect.objectContaining({ reason: 'refused', count: 2 })]);
  });

  it('a refused record at the END of many is found in a few requests too', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      players: [
        ...s.players,
        ...Array.from({ length: 60 }, (_, i) => ({
          ...s.players[0],
          id: `extra-${i}`,
          number: 20 + i,
          firstName: i === 59 ? 'Na\u0000me' : `Extra ${i}`,
        })),
      ],
    }));
    const pushed = watchPushes(a);
    await a.cycle();
    expect(cloud.record(T1, 'player', 'extra-58')).toBeDefined();
    expect(cloud.record(T1, 'player', 'extra-59')).toBeUndefined();
    expect(pushed.length).toBeLessThanOrEqual(16);
  });

  it('one large group that times out isn’t blamed on the batch size: one try, the size stays', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.edit((s) => ({
      matches: s.matches.map((m) =>
        m.id === 'm2'
          ? {
              ...m,
              sets: m.sets.map((x) => ({
                ...x,
                events: Array.from({ length: 600 }, () => stampedRally),
              })),
            }
          : m,
      ),
    }));
    let tries = 0;
    a.backend.pushRecords = async (_t: string, _d: string, items: readonly PushItem[]) => {
      tries += 1;
      expect(JSON.stringify(items).length).toBeGreaterThan(16 * 1024);
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    };
    await a.cycle();
    expect(tries).toBe(1);
    expect(a.engine.pushLimit).toEqual(PUSH_LIMITS);
    expect(a.runtime.status.phase).toBe('offline');
  });

  it('says what waits even when the push itself then fails', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await editPlayer(a, 'p2', { firstName: LONG });
    await editPlayer(a, 'p3', { firstName: 'Fine' });
    a.backend.pushRecords = async () => {
      throw new TypeError('Network request failed');
    };
    await a.cycle();
    expect(a.runtime.status.phase).toBe('offline');
    expect(unsent(a)).toHaveLength(1);
  });
});
