/**
 * v12 (store v14): hosted tournaments in the app store — actions, selectors, what goes with a
 * deleted profile, persistence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resetStores } from '@/test-utils';

import { STORAGE_KEY, emptyData, selectAppData, useAppStore } from './appStore';
import { selectHostedResults, selectHostedTeams, selectHostedTournaments } from './selectors';

const store = () => useAppStore.getState();

beforeEach(() => resetStores());

function seed() {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
  const cup = store().addHostedTournament({
    profileId: coach.id,
    name: 'Winter Cup',
    date: '2026-12-05',
    location: 'Halle Süd',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
  });
  const a = store().addHostedTeam(cup.id, 'TV Nord');
  const b = store().addHostedTeam(cup.id, 'Rivals');
  const c = store().addHostedTeam(cup.id, 'SC Blau');
  return { coach, other, cup, a, b, c };
}

describe('hosted tournaments', () => {
  it('starts without any', () => {
    expect(emptyData()).toMatchObject({
      hostedTournaments: [],
      hostedTeams: [],
      hostedResults: [],
    });
    expect(store().hostedTournaments).toEqual([]);
  });

  it('adds a tournament with an id and a creation time', () => {
    const { coach, cup } = seed();
    expect(cup).toMatchObject({ profileId: coach.id, name: 'Winter Cup', setsPerMatch: 3 });
    expect(cup.id).toBeTruthy();
    expect(Date.parse(cup.createdAt)).not.toBeNaN();
    expect(store().hostedTournaments).toEqual([cup]);
  });

  it('replaces a tournament’s values on update and drops omitted optional fields', () => {
    const { cup, coach } = seed();
    const second = store().addHostedTournament({
      profileId: coach.id,
      name: 'Second',
      setsPerMatch: 1,
      matchEnd: 'bestOf',
    });
    store().updateHostedTournament(cup.id, {
      name: 'Winter Cup 2',
      setsPerMatch: 2,
      matchEnd: 'allSets',
    });
    expect(store().hostedTournaments).toEqual([
      {
        id: cup.id,
        profileId: coach.id,
        createdAt: cup.createdAt,
        name: 'Winter Cup 2',
        setsPerMatch: 2,
        matchEnd: 'allSets',
        // left out of the update: who makes the plan stays
        plan: 'roundRobin',
      },
      second,
    ]);
  });

  it('lists the profile’s tournaments newest first (date, then creation)', () => {
    const { coach, other, cup } = seed();
    const add = (name: string, profileId: string, date?: string) =>
      store().addHostedTournament({
        profileId,
        name,
        setsPerMatch: 3,
        matchEnd: 'bestOf',
        ...(date ? { date } : {}),
      });
    const later = add('Later', coach.id, '2027-01-10');
    const undated = add('Undated', coach.id);
    add('Elsewhere', other.id, '2028-01-01');
    // Two without a date: the one created later comes first.
    useAppStore.setState((s) => ({
      hostedTournaments: [
        ...s.hostedTournaments,
        { ...undated, id: 'undated-2', name: 'Undated 2', createdAt: '2999-01-01T00:00:00.000Z' },
      ],
    }));
    expect(selectHostedTournaments(store(), coach.id).map((x) => x.name)).toEqual([
      'Later',
      'Winter Cup',
      'Undated 2',
      'Undated',
    ]);
    expect(later.date).toBe('2027-01-10');
    expect(cup.date).toBe('2026-12-05');
  });

  it('adds teams in order and renames them', () => {
    const { cup, a, b, c } = seed();
    expect([a.order, b.order, c.order]).toEqual([0, 1, 2]);
    store().renameHostedTeam(b.id, 'Rivals II');
    expect(selectHostedTeams(store(), cup.id).map((t) => t.name)).toEqual([
      'TV Nord',
      'Rivals II',
      'SC Blau',
    ]);
    // A team added after one was removed still comes last.
    store().deleteHostedTeam(b.id);
    const d = store().addHostedTeam(cup.id, 'New');
    expect(d.order).toBe(3);
    expect(selectHostedTeams(store(), 'nope')).toEqual([]);
  });

  it('stores a result as seen from the pair’s first team and replaces the pair’s result', () => {
    const { cup, a, b } = seed();
    // Entered from the second team's side.
    const first = store().setHostedResult(cup.id, b.id, a.id, [
      { a: 20, b: 25 },
      { a: 25, b: 27 },
    ]);
    expect(first).toMatchObject({
      tournamentId: cup.id,
      teamAId: a.id,
      teamBId: b.id,
      sets: [
        { a: 25, b: 20 },
        { a: 27, b: 25 },
      ],
    });
    const second = store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    expect(second?.id).toBe(first?.id);
    expect(selectHostedResults(store(), cup.id)).toEqual([
      {
        id: first?.id,
        tournamentId: cup.id,
        teamAId: a.id,
        teamBId: b.id,
        sets: [{ a: 25, b: 10 }],
      },
    ]);
  });

  it('ignores a result for a team that is not in the tournament, or for one team twice', () => {
    const { cup, a } = seed();
    expect(store().setHostedResult(cup.id, a.id, 'nobody', [{ a: 25, b: 10 }])).toBeUndefined();
    expect(store().setHostedResult(cup.id, 'nobody', a.id, [{ a: 25, b: 10 }])).toBeUndefined();
    expect(store().setHostedResult(cup.id, a.id, a.id, [{ a: 25, b: 10 }])).toBeUndefined();
    expect(store().hostedResults).toEqual([]);
  });

  it('deletes one pair’s result, whichever way round', () => {
    const { cup, a, b, c } = seed();
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    const kept = store().setHostedResult(cup.id, a.id, c.id, [{ a: 25, b: 10 }]);
    store().deleteHostedResult('another', b.id, a.id);
    expect(store().hostedResults).toHaveLength(2);
    store().deleteHostedResult(cup.id, b.id, a.id);
    expect(store().hostedResults).toEqual([kept]);
  });

  it('removing a team deletes its results and keeps the others', () => {
    const { cup, a, b, c } = seed();
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    store().setHostedResult(cup.id, b.id, c.id, [{ a: 25, b: 10 }]);
    const kept = store().setHostedResult(cup.id, a.id, c.id, [{ a: 25, b: 10 }]);
    store().deleteHostedTeam(b.id);
    expect(store().hostedTeams.map((t) => t.id)).toEqual([a.id, c.id]);
    expect(store().hostedResults).toEqual([kept]);
  });

  it('deleting a tournament deletes its teams and results', () => {
    const { cup, coach, a, b } = seed();
    const other = store().addHostedTournament({
      profileId: coach.id,
      name: 'Other',
      setsPerMatch: 1,
      matchEnd: 'bestOf',
    });
    const x = store().addHostedTeam(other.id, 'X');
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    store().deleteHostedTournament(cup.id);
    expect(store().hostedTournaments).toEqual([other]);
    expect(store().hostedTeams).toEqual([x]);
    expect(store().hostedResults).toEqual([]);
  });

  it('deleting a profile deletes its tournaments, not another profile’s', () => {
    const { coach, other, cup, a, b } = seed();
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    const theirs = store().addHostedTournament({
      profileId: other.id,
      name: 'Theirs',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    const team = store().addHostedTeam(theirs.id, 'Stays');
    store().deleteProfile(coach.id);
    expect(store().hostedTournaments).toEqual([theirs]);
    expect(store().hostedTeams).toEqual([team]);
    expect(store().hostedResults).toEqual([]);
  });

  it('"Delete all data" removes them', () => {
    const { cup, a, b } = seed();
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    store().resetAll();
    expect(selectAppData(store())).toEqual(emptyData());
  });

  it('replaceAll takes the given tournaments of profiles in the data, and none when left out', () => {
    const { coach, cup, a, b } = seed();
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    const data = selectAppData(store());
    // Only the coach's profile stays: a tournament of a missing profile is dropped.
    const stray = { ...cup, id: 'stray', profileId: 'gone' };
    store().replaceAll({
      ...data,
      profiles: data.profiles.filter((p) => p.id === coach.id),
      hostedTournaments: [...data.hostedTournaments, stray],
    });
    expect(store().hostedTournaments).toEqual([cup]);
    expect(store().hostedTeams).toHaveLength(3);
    expect(store().hostedResults).toHaveLength(1);
    const { hostedTournaments: _t, hostedTeams: _teams, hostedResults: _r, ...teamData } = data;
    store().replaceAll(teamData);
    expect(store().hostedTournaments).toEqual([]);
    expect(store().hostedTeams).toEqual([]);
    expect(store().hostedResults).toEqual([]);
  });

  it('is persisted and loaded again', async () => {
    const { cup, a, b } = seed();
    const result = store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 10 }]);
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
    expect(saved.version).toBe(15);
    expect(saved.state.hostedTournaments).toEqual([cup]);
    expect(saved.state.hostedResults).toEqual([result]);
    useAppStore.setState({ ...emptyData() });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    await useAppStore.persist.rehydrate();
    expect(store().hostedTournaments).toEqual([cup]);
    expect(store().hostedTeams).toHaveLength(3);
    expect(store().hostedResults).toEqual([result]);
  });

  it('data stored by 11.0.0 (store 13) opens without loss and gains the empty lists', async () => {
    const profile = { id: 'p', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' };
    const team = { id: 't1', profileId: 'p', name: 'Herren', createdAt: '2026-01-01' };
    const v13 = {
      version: 13,
      state: {
        profiles: [profile],
        teams: [team],
        players: [],
        matches: [],
        presets: [],
        seasons: [],
        opponents: [],
        currentProfileId: 'p',
        language: 'de',
        chipLabel: 'name',
        themeMode: 'light',
        dyslexiaFont: true,
        tourMode: 'none',
        tourSeen: [],
        sync: { deviceId: 'd1', account: null, teams: {} },
      },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v13));
    await useAppStore.persist.rehydrate();
    expect(store()).toMatchObject({
      profiles: [profile],
      teams: [team],
      currentProfileId: 'p',
      language: 'de',
      themeMode: 'light',
      dyslexiaFont: true,
      hostedTournaments: [],
      hostedTeams: [],
      hostedResults: [],
    });
    expect(store().sync.deviceId).toBe('d1');
  });
});

describe('own matches (v15, app 12.1)', () => {
  function seedManual() {
    const base = seed();
    const own = store().addHostedTournament({
      profileId: base.coach.id,
      name: 'Friendlies',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
      plan: 'manual',
    });
    const x = store().addHostedTeam(own.id, 'X');
    const y = store().addHostedTeam(own.id, 'Y');
    return { ...base, own, x, y };
  }

  it('a new tournament has the app-made plan unless it says otherwise', () => {
    const { cup, own } = seedManual();
    expect(cup.plan).toBe('roundRobin');
    expect(own.plan).toBe('manual');
    store().updateHostedTournament(own.id, {
      name: 'Renamed',
      setsPerMatch: 5,
      matchEnd: 'bestOf',
    });
    expect(store().hostedTournaments.find((t) => t.id === own.id)).toMatchObject({
      name: 'Renamed',
      plan: 'manual',
    });
    store().updateHostedTournament(own.id, {
      name: 'Renamed',
      setsPerMatch: 5,
      matchEnd: 'bestOf',
      plan: 'roundRobin',
    });
    expect(store().hostedTournaments.find((t) => t.id === own.id)?.plan).toBe('roundRobin');
  });

  it('adds matches in order, the team given first as team A, the same pair again', () => {
    const { own, x, y } = seedManual();
    const first = store().addHostedMatch(own.id, y.id, x.id);
    const second = store().addHostedMatch(own.id, x.id, y.id);
    expect(first).toMatchObject({ tournamentId: own.id, teamAId: y.id, teamBId: x.id, sets: [] });
    expect(second?.id).not.toBe(first?.id);
    expect(selectHostedResults(store(), own.id)).toEqual([first, second]);
  });

  it('adds nothing to a round robin, for an unknown tournament or team, or one team twice', () => {
    const { cup, a, b, own, x } = seedManual();
    expect(store().addHostedMatch(cup.id, a.id, b.id)).toBeUndefined();
    expect(store().addHostedMatch('nope', a.id, b.id)).toBeUndefined();
    expect(store().addHostedMatch(own.id, x.id, a.id)).toBeUndefined();
    expect(store().addHostedMatch(own.id, x.id, x.id)).toBeUndefined();
    expect(store().hostedResults).toEqual([]);
  });

  it('stores, clears and replaces one match’s sets without touching the pair’s other match', () => {
    const { own, x, y } = seedManual();
    const first = store().addHostedMatch(own.id, x.id, y.id);
    const second = store().addHostedMatch(own.id, x.id, y.id);
    store().setHostedMatchSets(first?.id ?? '', [
      { a: 25, b: 20 },
      { a: 25, b: 22 },
    ]);
    expect(store().hostedResults.map((r) => r.sets.length)).toEqual([2, 0]);
    store().setHostedMatchSets(first?.id ?? '', []);
    store().setHostedMatchSets(second?.id ?? '', [{ a: 9, b: 25 }]);
    expect(store().hostedResults.map((r) => r.sets)).toEqual([[], [{ a: 9, b: 25 }]]);
    store().setHostedMatchSets('nope', [{ a: 1, b: 0 }]);
    expect(store().hostedResults).toHaveLength(2);
  });

  it('a result by pair is not stored in a tournament with own matches', () => {
    const { own, x, y } = seedManual();
    store().addHostedMatch(own.id, x.id, y.id);
    expect(store().setHostedResult(own.id, x.id, y.id, [{ a: 25, b: 20 }])).toBeUndefined();
    expect(store().hostedResults.map((r) => r.sets)).toEqual([[]]);
  });

  it('deletes one match; removing a team deletes its matches', () => {
    const { own, x, y } = seedManual();
    const z = store().addHostedTeam(own.id, 'Z');
    const first = store().addHostedMatch(own.id, x.id, y.id);
    const second = store().addHostedMatch(own.id, x.id, y.id);
    const third = store().addHostedMatch(own.id, y.id, z.id);
    store().deleteHostedMatch(first?.id ?? '');
    expect(store().hostedResults).toEqual([second, third]);
    store().deleteHostedTeam(x.id);
    expect(store().hostedResults).toEqual([third]);
  });

  it('data stored by 12.0.0 (store 14) opens with the app-made plan for every tournament', async () => {
    const tournament = {
      id: 'h1',
      profileId: 'p',
      name: 'Winter Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
      createdAt: '2026-11-28T10:00:00.000Z',
    };
    const result = {
      id: 'r1',
      tournamentId: 'h1',
      teamAId: 'a',
      teamBId: 'b',
      sets: [{ a: 25, b: 20 }],
    };
    const v14 = {
      version: 14,
      state: {
        profiles: [{ id: 'p', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
        teams: [],
        players: [],
        matches: [],
        presets: [],
        seasons: [],
        opponents: [],
        hostedTournaments: [tournament],
        hostedTeams: [
          { id: 'a', tournamentId: 'h1', name: 'A', order: 0 },
          { id: 'b', tournamentId: 'h1', name: 'B', order: 1 },
        ],
        hostedResults: [result],
        currentProfileId: 'p',
        language: 'en',
        chipLabel: 'number',
        themeMode: 'dark',
        dyslexiaFont: false,
        tourMode: 'none',
        tourSeen: [],
        sync: { deviceId: 'd1', account: null, teams: {} },
      },
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(v14));
    await useAppStore.persist.rehydrate();
    expect(store().hostedTournaments).toEqual([{ ...tournament, plan: 'roundRobin' }]);
    expect(store().hostedTeams).toHaveLength(2);
    expect(store().hostedResults).toEqual([result]);
  });
});
