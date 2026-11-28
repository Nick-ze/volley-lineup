import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildExport, parseImport } from '@/domain/exportSchema';
import { emptySetLineup } from '@/domain/lineup';
import type { Formation } from '@/domain/types';

import {
  STORAGE_KEY,
  emptyData,
  lastStoreWriteFailed,
  selectAppData,
  useAppStore,
} from './appStore';
import { REPULL_CURSOR } from '@/domain/syncSchema';

import { migrateStore, STORE_VERSION } from './migrations';
import type { AppData } from './types';
import {
  selectCurrentProfile,
  selectMatchesForTeam,
  selectPlayersForTeam,
  selectPresetsForTeam,
  selectStarters,
  selectTeamsForProfile,
} from './selectors';
import { seasonRefs } from '@/test-utils/seasonRefs';

const withPhotos = (data: AppData) => ({ ...data, photos: [] });

const store = () => useAppStore.getState();

function seed() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1', season: '2026/27' });
  const p1 = store().addPlayer({
    teamId: team.id,
    firstName: 'Ana',
    lastName: 'Ace',
    number: 7,
    positions: ['S'],
    active: true,
  });
  const p2 = store().addPlayer({
    teamId: team.id,
    firstName: 'Ben',
    lastName: 'Block',
    number: 3,
    positions: ['MB'],
    active: true,
  });
  const match = store().addMatch({
    teamId: team.id,
    ...seasonRefs(team.id, 'Rivals'),
    opponent: 'Rivals',
    date: '2026-11-01',
    home: true,
  });
  return { profile, team, p1, p2, match };
}

beforeEach(async () => {
  store().resetAll();
  await AsyncStorage.clear();
});

describe('profiles', () => {
  it('adds, renames, selects and deletes a profile', () => {
    const p = store().addProfile({ name: 'A', color: '#fff' });
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    store().updateProfile(p.id, { name: 'B' });
    expect(store().profiles[0].name).toBe('B');
    store().selectProfile(p.id);
    expect(selectCurrentProfile(store())?.id).toBe(p.id);
    store().deleteProfile(p.id);
    expect(store().profiles).toHaveLength(0);
    expect(store().currentProfileId).toBeNull();
  });

  it('deleting a profile cascades to its teams, players and matches only', () => {
    const { profile } = seed();
    const other = store().addProfile({ name: 'Other', color: '#000' });
    const otherTeam = store().addTeam({ profileId: other.id, name: 'Damen' });
    store().selectProfile(other.id);
    store().deleteProfile(profile.id);
    expect(store().teams.map((t) => t.id)).toEqual([otherTeam.id]);
    expect(store().players).toHaveLength(0);
    expect(store().matches).toHaveLength(0);
    expect(store().currentProfileId).toBe(other.id);
  });
});

describe('teams', () => {
  it('adds, updates and deletes a team with cascade', () => {
    const { profile, team } = seed();
    store().updateTeam(team.id, { name: 'Herren 2' });
    expect(selectTeamsForProfile(store(), profile.id)[0].name).toBe('Herren 2');
    store().deleteTeam(team.id);
    expect(store().teams).toHaveLength(0);
    expect(store().players).toHaveLength(0);
    expect(store().matches).toHaveLength(0);
  });
});

describe('players', () => {
  it('adds, sorts by number, updates and deletes players', () => {
    const { team, p1 } = seed();
    expect(selectPlayersForTeam(store(), team.id).map((p) => p.number)).toEqual([3, 7]);
    store().updatePlayer(p1.id, { active: false });
    expect(store().players.find((p) => p.id === p1.id)?.active).toBe(false);
  });

  it('deleting a player removes them from lineups', () => {
    const { p1, p2, match } = seed();
    store().setLineup(match.id, {
      ...emptySetLineup(1),
      slots: { 1: p1.id, 2: p2.id, 3: null, 4: null, 5: null, 6: null },
      liberoId: p1.id,
    });
    store().deletePlayer(p1.id);
    const set = store().matches[0].sets[0];
    expect(set.slots[1]).toBeNull();
    expect(set.slots[2]).toBe(p2.id);
    expect(set.liberoId).toBeNull();
  });

  it('deleting a player clears libero replacements and substitutions, so the export still imports', () => {
    const { p1, p2, match } = seed();
    const p3 = store().addPlayer({
      teamId: p1.teamId,
      firstName: 'Cid',
      lastName: 'Sub',
      number: 9,
      positions: ['OH'],
      active: true,
    });
    store().setLineup(match.id, {
      ...emptySetLineup(1),
      slots: { 1: p1.id, 2: null, 3: null, 4: null, 5: null, 6: null },
      liberoId: p2.id,
      liberoReplaces: [p1.id],
      events: [{ type: 'sub', outPlayerId: p1.id, inPlayerId: p3.id }],
    });
    store().deletePlayer(p3.id);
    store().deletePlayer(p1.id);
    const set = store().matches[0].sets[0];
    expect(set.liberoReplaces).toEqual([]);
    expect(set.events).toEqual([]);
    const text = JSON.stringify(buildExport(withPhotos(selectAppData(store()))));
    expect(parseImport(text).ok).toBe(true);
  });

  it('deleting an unknown player is a no-op', () => {
    seed();
    const before = store().matches;
    store().deletePlayer('nope');
    expect(store().matches).toBe(before);
  });
});

describe('team captain (v12)', () => {
  const captainOf = (teamId: string) => store().teams.find((t) => t.id === teamId)?.captainId;

  it('sets, moves and clears the captain', () => {
    const { team, p1, p2 } = seed();
    expect(captainOf(team.id)).toBeUndefined();
    store().setCaptain(team.id, p1.id, true);
    expect(captainOf(team.id)).toBe(p1.id);
    store().setCaptain(team.id, p2.id, true); // p1 loses it
    expect(captainOf(team.id)).toBe(p2.id);
    store().setCaptain(team.id, p1.id, false); // not the captain: nothing changes
    expect(captainOf(team.id)).toBe(p2.id);
    store().setCaptain(team.id, p2.id, false);
    expect(store().teams[0]).not.toHaveProperty('captainId');
  });

  it('only a player of that team can be its captain', () => {
    const { team, profile, p1 } = seed();
    const other = store().addTeam({ profileId: profile.id, name: 'Damen' });
    store().setCaptain(other.id, p1.id, true);
    store().setCaptain(team.id, 'nope', true);
    expect(captainOf(other.id)).toBeUndefined();
    expect(captainOf(team.id)).toBeUndefined();
  });

  it('deleting the captain clears it; deleting another player keeps it; the export imports', () => {
    const { team, p1, p2 } = seed();
    store().setCaptain(team.id, p1.id, true);
    store().deletePlayer(p2.id);
    expect(captainOf(team.id)).toBe(p1.id);
    store().deletePlayer(p1.id);
    expect(store().teams[0]).not.toHaveProperty('captainId');
    const text = JSON.stringify(buildExport(withPhotos(selectAppData(store()))));
    expect(parseImport(text).ok).toBe(true);
  });

  it('deleting the team takes its captain with it', () => {
    const { team, p1 } = seed();
    store().setCaptain(team.id, p1.id, true);
    store().deleteTeam(team.id);
    expect(store().teams).toEqual([]);
    expect(store().players).toEqual([]);
  });
});

describe('matches', () => {
  it('creates a match with set 1 by default', () => {
    const { match } = seed();
    expect(match.sets).toEqual([emptySetLineup(1)]);
  });

  it('accepts explicit sets, updates and deletes', () => {
    const { team } = seed();
    const m = store().addMatch({
      teamId: team.id,
      ...seasonRefs(team.id, 'X'),
      opponent: 'X',
      date: '2026-12-01',
      home: false,
      sets: [emptySetLineup(1), emptySetLineup(2)],
    });
    expect(m.sets).toHaveLength(2);
    expect(selectMatchesForTeam(store(), team.id)[0].id).toBe(m.id); // newest first
    store().updateMatch(m.id, { opponent: 'Y' });
    expect(store().matches.find((x) => x.id === m.id)?.opponent).toBe('Y');
    store().deleteMatch(m.id);
    expect(store().matches.find((x) => x.id === m.id)).toBeUndefined();
  });

  it('setLineup inserts new sets in order and replaces existing ones', () => {
    const { match, p1 } = seed();
    store().setLineup(match.id, emptySetLineup(3));
    store().setLineup(match.id, emptySetLineup(2));
    store().setLineup(match.id, { ...emptySetLineup(1), weServeFirst: false, liberoId: p1.id });
    const sets = store().matches[0].sets;
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(sets[0].weServeFirst).toBe(false);
    expect(sets[0].liberoId).toBe(p1.id);
  });
});

describe('presets', () => {
  const lineup = (ids: (string | null)[], liberoId: string | null = null) => ({
    slots: {
      1: ids[0] ?? null,
      2: ids[1] ?? null,
      3: ids[2] ?? null,
      4: ids[3] ?? null,
      5: ids[4] ?? null,
      6: ids[5] ?? null,
    },
    liberoId,
    liberoReplaces: [] as string[],
    formation: { system: '5-1', order: 'outside', setterAt: 1 } satisfies Formation,
    liberoActive: true,
  });

  it('adds, renames, edits and deletes a preset', () => {
    const { team, p1 } = seed();
    const preset = store().addPreset({ teamId: team.id, name: '5-1' });
    expect(preset).toMatchObject({ kind: 'preset', name: '5-1', liberoId: null });
    expect(preset.slots).toEqual({ 1: null, 2: null, 3: null, 4: null, 5: null, 6: null });
    store().updatePreset(preset.id, { name: 'Strong serve', ...lineup([p1.id]) });
    expect(selectPresetsForTeam(store(), team.id)[0]).toMatchObject({
      name: 'Strong serve',
      slots: { 1: p1.id },
    });
    store().deletePreset(preset.id);
    expect(store().presets).toEqual([]);
  });

  it('setStarters creates the single starters preset and then replaces its lineup', () => {
    const { team, p1, p2 } = seed();
    const first = store().setStarters(team.id, lineup([p1.id], p2.id));
    const second = store().setStarters(team.id, lineup([p2.id]));
    expect(second.id).toBe(first.id);
    expect(store().presets).toHaveLength(1);
    expect(selectStarters(store(), team.id)).toMatchObject({
      kind: 'starters',
      slots: { 1: p2.id },
      liberoId: null,
    });
    expect(selectPresetsForTeam(store(), team.id)).toEqual([]); // starters are not listed
  });

  it('deleting a team or profile deletes its presets', () => {
    const { profile, team } = seed();
    const other = store().addProfile({ name: 'Other', color: '#000' });
    const otherTeam = store().addTeam({ profileId: other.id, name: 'Damen' });
    store().addPreset({ teamId: team.id, name: 'A' });
    store().addPreset({ teamId: otherTeam.id, name: 'B' });
    store().setStarters(team.id, lineup([]));
    store().deleteTeam(team.id);
    expect(store().presets.map((p) => p.name)).toEqual(['B']);
    store().addTeam({ profileId: profile.id, name: 'X' });
    store().deleteProfile(other.id);
    expect(store().presets).toEqual([]);
  });

  it('deleting a player clears them from presets, even next to a played set', () => {
    const { team, p1, p2, match } = seed();
    store().setLineup(match.id, {
      ...emptySetLineup(1),
      slots: { 1: p2.id, 2: null, 3: null, 4: null, 5: null, 6: null },
      events: [{ type: 'point', winner: 'us' }],
    });
    const preset = store().addPreset({
      teamId: team.id,
      name: 'A',
      ...lineup([p1.id, p2.id], null),
      liberoReplaces: [p1.id],
    });
    store().setStarters(team.id, lineup([p2.id], p1.id));
    store().deletePlayer(p1.id);
    const [a, starters] = store().presets;
    expect(a.slots[1]).toBeNull();
    expect(a.slots[2]).toBe(p2.id);
    expect(a.liberoReplaces).toEqual([]);
    expect(starters.liberoId).toBeNull();
    expect(a.id).toBe(preset.id);
    const text = JSON.stringify(buildExport(withPhotos(selectAppData(store()))));
    expect(parseImport(text).ok).toBe(true);
  });
});

describe('whole data', () => {
  it('replaceAll swaps data and keeps the current profile only if it still exists', () => {
    const { profile } = seed();
    store().selectProfile(profile.id);
    const snapshot = selectAppData(store());
    store().replaceAll(snapshot);
    expect(store().currentProfileId).toBe(profile.id);
    store().replaceAll(emptyData());
    expect(store().currentProfileId).toBeNull();
    expect(store().profiles).toEqual([]);
  });

  it('persists to AsyncStorage', async () => {
    seed();
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(STORE_VERSION);
    expect(parsed.state.players).toHaveLength(2);
    expect(parsed.state.hydrated).toBeUndefined();
  });

  it('rehydrates from AsyncStorage', async () => {
    const { profile } = seed();
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    useAppStore.setState({ ...emptyData() }); // also overwrites storage…
    await AsyncStorage.setItem(STORAGE_KEY, raw as string); // …so restore the saved copy
    await useAppStore.persist.rehydrate();
    expect(store().profiles[0].id).toBe(profile.id);
    expect(store().hydrated).toBe(true);
  });

  it.each([
    ['null', null],
    ['without teams', { deviceId: 'dev-1', account: null }],
    ['a team without bookkeeping', { deviceId: 'dev-1', account: null, teams: { t1: {} } }],
  ])(
    'a malformed stored sync slice (%s) loads as the empty one (audit L32)',
    async (_name, sync) => {
      const { profile } = seed();
      await new Promise((r) => setTimeout(r, 0));
      const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
      useAppStore.setState({ ...emptyData() });
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...saved, state: { ...saved.state, sync } }),
      );
      await useAppStore.persist.rehydrate();
      expect(store().profiles[0].id).toBe(profile.id);
      expect(store().sync).toEqual({
        deviceId: sync === null ? null : 'dev-1',
        account: null,
        teams: {},
      });
      // What threw before: the Teams tab's shared-team lookups and "Delete all data".
      expect(() => store().resetAll()).not.toThrow();
    },
  );

  it('a valid stored sync slice loads unchanged, also with fields of a newer version', async () => {
    seed();
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
    const sync = {
      deviceId: 'dev-1',
      account: { userId: 'u1', email: 'a@example.test', profileId: 'p1' },
      teams: {
        t1: {
          userId: 'u1',
          role: 'manager',
          cursor: 4,
          base: { 'team:t1': { v: 4, h: 'abc', at: '2026-01-01T00:00:00.000Z' } },
          edits: {},
          photos: [],
          later: 1,
        },
      },
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
    };
    useAppStore.setState({ ...emptyData() });
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...saved, state: { ...saved.state, sync } }),
    );
    await useAppStore.persist.rehydrate();
    expect(store().sync).toEqual(sync);
  });
});

/**
 * v7.0: every migration from before store v9 also runs the seasons step; for states without
 * teams it only adds empty `seasons` / `opponents` lists. Asserts that, and returns the rest.
 */
/**
 * The migrated state without what later steps add to every old state: the empty seasons /
 * opponents (v9), the v10 device settings (dark theme, platform font) and the v11 tour settings
 * (not chosen yet, nothing seen), which it checks.
 */
/** v10 (store v13): what the v12 → v13 step adds — no account, no shared teams. */
const NO_SYNC = { deviceId: null, account: null, teams: {} };
/** v12 (store v14): what the v13 → v14 step adds — no hosted tournaments. */
const NO_HOSTED = {
  hostedTournaments: [],
  hostedTeams: [],
  hostedResults: [],
  // v12.2 (store v16): what the v15 → v16 step adds — no players of hosted teams
  hostedPlayers: [],
};

function withoutEmptySeasons(state: unknown): unknown {
  const {
    seasons,
    opponents,
    themeMode,
    dyslexiaFont,
    tourMode,
    tourSeen,
    sync,
    hostedTournaments,
    hostedTeams,
    hostedResults,
    hostedPlayers,
    ...rest
  } = state as Record<string, unknown>;
  expect({ hostedTournaments, hostedTeams, hostedResults, hostedPlayers }).toEqual(NO_HOSTED);
  expect(sync).toEqual(NO_SYNC);
  expect(seasons).toEqual([]);
  expect(opponents).toEqual([]);
  expect(themeMode).toBe('dark');
  expect(dyslexiaFont).toBe(false);
  expect(tourMode).toBeNull();
  expect(tourSeen).toEqual([]);
  return rest;
}

describe('lastStoreWriteFailed (audit M19)', () => {
  const setItem = jest.mocked(AsyncStorage.setItem);
  const fail = () =>
    setItem.mockImplementationOnce(async () => {
      throw new Error('storage full');
    });
  /** A write of the data; resolves when it has finished, whatever its result. */
  const write = (language: 'en' | 'de') =>
    Promise.resolve(useAppStore.setState({ language })).then(
      () => undefined,
      () => undefined,
    );

  it('is false after a write that worked and true after one that failed', async () => {
    await write('de');
    expect(lastStoreWriteFailed()).toBe(false);
    fail();
    await write('en');
    expect(lastStoreWriteFailed()).toBe(true);
    await write('de');
    expect(lastStoreWriteFailed()).toBe(false);
  });

  it('two writes that both work but land in the wrong order: the older data is what is stored', async () => {
    let finishOlder: () => void = () => {};
    setItem.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOlder = resolve;
        }),
    );
    const older = write('de');
    await write('en'); // the newer write lands first
    expect(lastStoreWriteFailed()).toBe(false);
    finishOlder();
    await older;
    // Found by the review: this counted as "all stored", and no idle cycle wrote it again.
    expect(lastStoreWriteFailed()).toBe(true);
    await write('de');
    expect(lastStoreWriteFailed()).toBe(false);
  });

  it('goes by the newest write, also when an older one finishes after it', async () => {
    // The older write takes a while and works; the newer one fails at once.
    let finishOlder: () => void = () => {};
    setItem.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishOlder = resolve;
        }),
    );
    const older = write('de');
    fail();
    await write('en');
    expect(lastStoreWriteFailed()).toBe(true);
    finishOlder();
    await older;
    // What is stored is the older write's data: the newest state still isn't saved.
    expect(lastStoreWriteFailed()).toBe(true);
    await write('de');
    expect(lastStoreWriteFailed()).toBe(false);
  });

  it('an older write that fails doesn’t count once a newer one has worked', async () => {
    let failOlder: (e: Error) => void = () => {};
    setItem.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          failOlder = reject;
        }),
    );
    const older = write('de');
    await write('en');
    failOlder(new Error('late failure'));
    await older;
    expect(lastStoreWriteFailed()).toBe(false);
  });
});

describe('migrations', () => {
  it('passes current data through and rejects newer versions', () => {
    expect(migrateStore({ a: 1 }, STORE_VERSION)).toEqual({ a: 1 });
    expect(() => migrateStore({}, STORE_VERSION + 1)).toThrow();
  });

  describe('an update from a version with shared teams (audit L6)', () => {
    const team = { userId: 'u1', role: 'manager', cursor: 57, base: {}, edits: {}, photos: [] };
    const sync = { deviceId: 'd1', account: null, teams: { t1: team, t2: { ...team, cursor: 3 } } };

    it('puts the pull cursors back to the start, so each team is pulled once more', () => {
      const next = migrateStore({ teams: [], sync }, 13, STORE_VERSION + 1) as {
        teams: unknown[];
        sync: typeof sync;
      };
      expect(next.sync.teams.t1).toEqual({ ...team, cursor: REPULL_CURSOR });
      expect(next.sync.teams.t2).toEqual({ ...team, cursor: REPULL_CURSOR });
      expect(next.sync.deviceId).toBe('d1');
      expect(next.teams).toEqual([]);
    });

    it('leaves the cursors alone without an update', () => {
      expect(migrateStore({ sync }, STORE_VERSION)).toEqual({ sync });
    });

    it('replaces a malformed sync slice by the empty one instead of failing', () => {
      expect(migrateStore({ sync: { deviceId: 'd1', teams: 'x' } }, 13, 14)).toEqual({
        sync: { deviceId: 'd1', account: null, teams: {} },
        ...NO_HOSTED,
      });
      expect(migrateStore(null, 13, 14)).toBeNull();
    });

    it('an update from before v13 starts with the empty sync state', () => {
      expect(migrateStore({ presets: [] }, 12, 14)).toMatchObject({
        sync: { deviceId: null, account: null, teams: {} },
      });
    });
  });

  it('upgrades v1 data: sets gain liberoReplaces/events, state gains language', () => {
    const v1 = {
      profiles: [],
      currentProfileId: null,
      matches: [
        {
          id: 'm1',
          sets: [{ setNumber: 1, slots: {}, liberoId: null, weServeFirst: true }, 'junk'],
        },
        'junk',
        { id: 'm2' },
      ],
    };
    expect(withoutEmptySeasons(migrateStore(v1, 1))).toEqual({
      chipLabel: 'number',
      presets: [],
      language: 'en',
      profiles: [],
      currentProfileId: null,
      matches: [
        {
          id: 'm1',
          sets: [
            {
              setNumber: 1,
              slots: {},
              liberoId: null,
              weServeFirst: true,
              liberoReplaces: [],
              events: [],
              formation: { system: '5-1', order: 'outside', setterAt: 1 },
              liberoActive: true,
            },
            'junk',
          ],
        },
        'junk',
        { id: 'm2' },
      ],
    });
    expect(withoutEmptySeasons(migrateStore({ matches: 'x' }, 1))).toEqual({
      chipLabel: 'number',
      presets: [],
      language: 'en',
      matches: 'x',
    });
    expect(migrateStore(null, 1)).toBeNull();
  });

  it('upgrades v2 data: the state gains an empty preset list', () => {
    const v2 = { profiles: [], matches: [], language: 'de' };
    expect(withoutEmptySeasons(migrateStore(v2, 2))).toEqual({
      chipLabel: 'number',
      presets: [],
      profiles: [],
      matches: [],
      language: 'de',
    });
    expect(migrateStore(null, 2)).toBeNull();
  });

  it('opens v3 data (v2.x app) without loss: untagged points stay valid', () => {
    const v3 = {
      profiles: [],
      presets: [],
      language: 'en',
      matches: [
        {
          id: 'm',
          sets: [
            {
              events: [
                { type: 'point', winner: 'us' },
                { type: 'sub', outPlayerId: 'a', inPlayerId: 'b' },
              ],
            },
          ],
        },
      ],
    };
    // v3 → v4 changes nothing; v4 → v5 adds the chip setting; v5 → v6 the lineup defaults;
    // v6 → v7 passes this set (it has no slots) through, so its empty `roles` stay.
    expect(withoutEmptySeasons(migrateStore(v3, 3))).toEqual({
      ...v3,
      chipLabel: 'number',
      matches: [
        {
          ...v3.matches[0],
          sets: [{ ...v3.matches[0].sets[0], roles: {}, liberoActive: true }],
        },
      ],
    });
  });

  it('upgrades v4 data (v3.0 app): player chips keep showing numbers', () => {
    const v4 = { profiles: [], presets: [], matches: [], language: 'de' };
    expect(withoutEmptySeasons(migrateStore(v4, 4))).toEqual({ ...v4, chipLabel: 'number' });
    expect(migrateStore(null, 4)).toBeNull();
  });

  it('upgrades v5 data (v3.1 app): sets and presets get no role overrides and the libero on', () => {
    const v5 = {
      chipLabel: 'name',
      presets: [{ id: 'ps', slots: {} }, 'junk'],
      matches: [{ id: 'm', sets: [{ setNumber: 1 }, 'junk'] }, { id: 'n' }, 'junk'],
    };
    // v5 → v6 adds `roles: {}`; v6 → v7 turns it into the default formation where there are
    // slots (the preset) and passes the slot-less set through.
    expect(withoutEmptySeasons(migrateStore(v5, 5))).toEqual({
      chipLabel: 'name',
      presets: [
        {
          id: 'ps',
          slots: {},
          formation: { system: '5-1', order: 'outside', setterAt: 1 },
          liberoActive: true,
        },
        'junk',
      ],
      matches: [
        { id: 'm', sets: [{ setNumber: 1, roles: {}, liberoActive: true }, 'junk'] },
        { id: 'n' },
        'junk',
      ],
    });
    // a stored choice is kept
    const off = {
      matches: [{ sets: [{ roles: { a: 'OH' }, liberoActive: false }] }],
      presets: 'x',
    };
    expect(withoutEmptySeasons(migrateStore(off, 5))).toEqual(off);
    expect(migrateStore(null, 5)).toBeNull();
  });

  it('upgrades v6 data (v4 app): per-player roles become a formation per set and preset', () => {
    const players = [
      { id: 's', positions: ['S'] },
      { id: 'oh', positions: ['OH'] },
      { id: 'mb', positions: ['MB'] },
      { id: 'opp', positions: ['OPP', 'S'] },
    ];
    const slots = { 1: 'opp', 2: null, 3: 's', 4: 'mb', 5: null, 6: 'oh' };
    const v6 = {
      players,
      matches: [
        {
          id: 'm',
          sets: [
            { setNumber: 1, slots, roles: {}, liberoActive: true }, // setter at 3, MB next
            { setNumber: 2, slots, roles: { opp: 'S', s: 'OPP' }, liberoActive: false },
            { setNumber: 3, slots, roles: { s: 'S', oh: 'S' }, liberoActive: true }, // 3 and 6
            'junk',
          ],
        },
        { id: 'n' },
        'junk',
      ],
      presets: [{ id: 'ps', slots, roles: { mb: 'OH' } }, 'junk'],
    };
    expect(withoutEmptySeasons(migrateStore(v6, 6))).toEqual({
      players,
      matches: [
        {
          id: 'm',
          sets: [
            {
              setNumber: 1,
              slots,
              formation: { system: '5-1', order: 'middle', setterAt: 3 },
              liberoActive: true,
            },
            {
              setNumber: 2,
              slots,
              formation: { system: '5-1', order: 'outside', setterAt: 1 }, // opp sets at 1
              liberoActive: false,
            },
            {
              setNumber: 3,
              slots,
              formation: { system: '6-2', order: 'middle', setterAt: 3 },
              liberoActive: true,
            },
            'junk',
          ],
        },
        { id: 'n' },
        'junk',
      ],
      presets: [
        { id: 'ps', slots, formation: { system: '5-1', order: 'outside', setterAt: 3 } },
        'junk',
      ],
    });
    // malformed collections are passed through; without players only overrides count
    const odd = { players: 'x', matches: 'x', presets: { a: 1 } };
    expect(withoutEmptySeasons(migrateStore(odd, 6))).toEqual(odd);
    const noPlayers = { matches: [{ sets: [{ slots, roles: { oh: 'S' } }] }], presets: [] };
    expect(withoutEmptySeasons(migrateStore(noPlayers, 6))).toEqual({
      matches: [{ sets: [{ slots, formation: { system: '5-1', order: 'outside', setterAt: 6 } }] }],
      presets: [],
    });
    // a lineup that already has a formation is left alone
    const current = {
      matches: [{ sets: [{ slots, formation: { system: '6-2', order: 'outside', setterAt: 2 } }] }],
    };
    expect(withoutEmptySeasons(migrateStore(current, 6))).toEqual(current);
    expect(migrateStore(null, 6)).toBeNull();
    expect(STORE_VERSION).toBe(16); // v12.2: players of hosted teams, live scoring
  });

  it('migrates v9 data (v7 app): dark theme and platform font, nothing else changes', () => {
    const v9 = {
      teams: [{ id: 't1', profileId: 'p', name: 'Herren', createdAt: '2026-01-01' }],
      matches: [],
      seasons: [],
      opponents: [],
      language: 'de',
      chipLabel: 'name',
    };
    // (v9.0: the v10 → v11 step adds the tour settings after it, see the next test)
    const tour = { tourMode: null, tourSeen: [] };
    const sync = { sync: NO_SYNC, ...NO_HOSTED }; // v10.0: the v12 → v13 step; v12.0: v13 → v14
    expect(migrateStore(v9, 9)).toEqual({
      ...v9,
      themeMode: 'dark',
      dyslexiaFont: false,
      ...tour,
      ...sync,
    });
    // a state that already has the settings keeps them
    const v10 = { ...v9, themeMode: 'light', dyslexiaFont: true };
    expect(migrateStore(v10, 9)).toEqual({ ...v10, ...tour, ...sync });
  });

  it('migrates v10 data (v8 app): the tour is not chosen yet, nothing else changes', () => {
    const v10 = {
      teams: [{ id: 't1', profileId: 'p', name: 'Herren', createdAt: '2026-01-01' }],
      matches: [],
      seasons: [],
      opponents: [],
      language: 'de',
      chipLabel: 'name',
      themeMode: 'light',
      dyslexiaFont: true,
    };
    expect(migrateStore(v10, 10)).toEqual({
      ...v10,
      tourMode: null,
      tourSeen: [],
      sync: NO_SYNC,
      ...NO_HOSTED,
    });
    // a state that already has the settings keeps them
    const v11 = { ...v10, tourMode: 'quick', tourSeen: ['profiles'] };
    expect(migrateStore(v11, 10)).toEqual({ ...v11, sync: NO_SYNC, ...NO_HOSTED });
    expect(migrateStore(null, 10)).toBeNull();
  });

  it('migrates v11 data (v9.0 app): the captain is optional, nothing changes', () => {
    const v11 = {
      teams: [{ id: 't1', profileId: 'p', name: 'Herren', createdAt: '2026-01-01' }],
      players: [],
      matches: [],
      seasons: [],
      opponents: [],
      language: 'de',
      chipLabel: 'name',
      themeMode: 'light',
      dyslexiaFont: true,
      tourMode: 'quick',
      tourSeen: ['profiles'],
    };
    expect(migrateStore(v11, 11)).toEqual({ ...v11, sync: NO_SYNC, ...NO_HOSTED });
    expect(migrateStore(null, 11)).toBeNull();
  });

  it('migrates v13 data (v10 / v11 app): gains the empty hosted-tournament lists, nothing else changes', () => {
    const v13 = {
      profiles: [{ id: 'p', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
      teams: [{ id: 't1', profileId: 'p', name: 'Herren', createdAt: '2026-01-01' }],
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
      tourMode: 'quick',
      tourSeen: ['profiles'],
      sync: NO_SYNC,
    };
    expect(migrateStore(v13, 13)).toEqual({ ...v13, ...NO_HOSTED });
    // a state that already has tournaments keeps them
    const tournament = {
      id: 'h1',
      profileId: 'p',
      name: 'Winter Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
      createdAt: '2026-11-28',
    };
    // (v12.1: the v14 → v15 step then gives it `plan: 'roundRobin'`)
    const v14 = { ...v13, ...NO_HOSTED, hostedTournaments: [tournament] };
    expect(migrateStore(v14, 13)).toEqual({
      ...v14,
      hostedTournaments: [{ ...tournament, plan: 'roundRobin' }],
    });
    expect(migrateStore(null, 13)).toBeNull();
  });

  it('migrates v15 data (v12.1 app): gains the empty list of hosted players, nothing else changes', () => {
    const v15 = {
      profiles: [],
      hostedTournaments: [{ id: 'h1', profileId: 'p', name: 'Cup', plan: 'manual' }],
      hostedTeams: [{ id: 'a', tournamentId: 'h1', name: 'A', order: 0 }],
      hostedResults: [{ id: 'm1', tournamentId: 'h1', teamAId: 'a', teamBId: 'b', sets: [] }],
      sync: NO_SYNC,
    };
    expect(migrateStore(v15, 15)).toEqual({ ...v15, hostedPlayers: [] });
    // a state that already has players keeps them
    const v16 = { ...v15, hostedPlayers: [{ id: 'p1', teamId: 'a', number: 6 }] };
    expect(migrateStore(v16, 15)).toEqual(v16);
    expect(migrateStore(null, 15)).toBeNull();
  });

  it('migrates v14 data (v12.0 app): every hosted tournament gets the app-made plan', () => {
    const tournament = {
      id: 'h1',
      profileId: 'p',
      name: 'Winter Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
      createdAt: '2026-11-28',
    };
    const result = {
      id: 'r1',
      tournamentId: 'h1',
      teamAId: 'a',
      teamBId: 'b',
      sets: [{ a: 25, b: 20 }],
    };
    const v14 = {
      profiles: [],
      teams: [],
      hostedTournaments: [tournament, { ...tournament, id: 'h2', plan: 'manual' }],
      hostedTeams: [],
      hostedResults: [result],
      sync: NO_SYNC,
    };
    // (v12.2: the v15 → v16 step then adds the empty player list)
    const players = { hostedPlayers: [] };
    expect(migrateStore(v14, 14)).toEqual({
      ...v14,
      ...players,
      hostedTournaments: [
        { ...tournament, plan: 'roundRobin' },
        // one that already says who makes the plan keeps it
        { ...tournament, id: 'h2', plan: 'manual' },
      ],
    });
    // anything that isn't a list of records is left for the load to deal with
    expect(migrateStore({ hostedTournaments: 'x', sync: NO_SYNC }, 14)).toEqual({
      hostedTournaments: 'x',
      sync: NO_SYNC,
      ...players,
    });
    expect(migrateStore({ hostedTournaments: [7], sync: NO_SYNC }, 14)).toEqual({
      hostedTournaments: [7],
      sync: NO_SYNC,
      ...players,
    });
    expect(migrateStore(null, 14)).toBeNull();
  });

  it('migrates old data (v1) through to v11 with the tour not chosen', () => {
    const up = migrateStore({ profiles: [], teams: [], players: [], matches: [] }, 1) as Record<
      string,
      unknown
    >;
    expect(up.tourMode).toBeNull();
    expect(up.tourSeen).toEqual([]);
    expect(up.themeMode).toBe('dark');
  });

  it('remembers the tour choice and the seen pages, also after delete all', () => {
    store().setTourMode('quick');
    expect(store().tourMode).toBe('quick');
    expect(store().tourSeen).toEqual([]);
    store().markTourSeen('profiles');
    store().markTourSeen('teams');
    const before = store().tourSeen;
    store().markTourSeen('teams'); // already seen: unchanged (same list)
    expect(store().tourSeen).toBe(before);
    expect(store().tourSeen).toEqual(['profiles', 'teams']);
    store().resetAll();
    expect(store().tourMode).toBe('quick');
    expect(store().tourSeen).toEqual(['profiles', 'teams']);
    // choosing a tour again starts it over
    store().setTourMode('full');
    expect(store().tourMode).toBe('full');
    expect(store().tourSeen).toEqual([]);
    store().setTourMode('none');
  });

  it('persists the tour settings', async () => {
    store().setTourMode('full');
    store().markTourSeen('roster');
    await new Promise((r) => setTimeout(r, 0));
    const parsed = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
    expect(parsed.state.tourMode).toBe('full');
    expect(parsed.state.tourSeen).toEqual(['roster']);
    store().setTourMode('none');
  });

  it('remembers the theme and the dyslexia font, also after delete all', () => {
    expect(store().themeMode).toBe('dark');
    expect(store().dyslexiaFont).toBe(false);
    store().setThemeMode('light');
    store().setDyslexiaFont(true);
    store().resetAll();
    expect(store().themeMode).toBe('light');
    expect(store().dyslexiaFont).toBe(true);
    store().setThemeMode('system');
    expect(store().themeMode).toBe('system');
    store().setThemeMode('dark');
    store().setDyslexiaFont(false);
  });

  it('remembers whether chips show names or numbers, also after delete all', () => {
    expect(store().chipLabel).toBe('number');
    store().setChipLabel('name');
    store().resetAll();
    expect(store().chipLabel).toBe('name');
    store().setChipLabel('number');
  });

  it('remembers the chosen language', () => {
    store().setLanguage('de');
    expect(store().language).toBe('de');
    store().setLanguage('en');
  });
});

describe('v9 seasons and opponents', () => {
  beforeEach(() => store().resetAll());

  it('adds, edits and deletes a season with its opponents and matches', () => {
    const team = store().addTeam({ profileId: 'p', name: 'Herren' });
    const cup = store().addSeason({
      teamId: team.id,
      name: 'Cup',
      kind: 'tournament',
      location: 'Halle',
    });
    const rivals = store().addOpponent(cup.id, 'Rivals');
    store().addMatch({
      teamId: team.id,
      seasonId: cup.id,
      opponentId: rivals.id,
      opponent: 'Rivals',
      date: '2026-06-01',
      home: true,
    });
    store().updateSeason(cup.id, {
      name: 'Beach Cup',
      kind: 'tournament',
      startDate: '2026-06-01',
    });
    expect(store().seasons[0]).toEqual({
      id: cup.id,
      teamId: team.id,
      createdAt: cup.createdAt,
      name: 'Beach Cup',
      kind: 'tournament',
      startDate: '2026-06-01',
    }); // location removed
    store().deleteSeason(cup.id);
    expect([store().seasons, store().opponents, store().matches]).toEqual([[], [], []]);
  });

  it('renames an opponent with its matches; deletes only an opponent without matches', () => {
    const team = store().addTeam({ profileId: 'p', name: 'Herren' });
    const s = store().addSeason({ teamId: team.id, name: '2026', kind: 'season' });
    const a = store().addOpponent(s.id, 'Rivals');
    const b = store().addOpponent(s.id, 'Unused');
    store().addMatch({
      teamId: team.id,
      seasonId: s.id,
      opponentId: a.id,
      opponent: 'Rivals',
      date: '2026-06-01',
      home: true,
    });
    store().renameOpponent(a.id, 'Rivals 1');
    expect(store().opponents[0]?.name).toBe('Rivals 1');
    expect(store().matches[0]?.opponent).toBe('Rivals 1');
    store().deleteOpponent(a.id);
    expect(store().opponents).toHaveLength(2);
    store().deleteOpponent(b.id);
    expect(store().opponents.map((o) => o.id)).toEqual([a.id]);
  });

  it('deleting a team or profile removes its seasons and opponents', () => {
    const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
    const t1 = store().addTeam({ profileId: profile.id, name: 'A' });
    const t2 = store().addTeam({ profileId: 'other', name: 'B' });
    const s1 = store().addSeason({ teamId: t1.id, name: '2026', kind: 'season' });
    const s2 = store().addSeason({ teamId: t2.id, name: '2026', kind: 'season' });
    store().addOpponent(s1.id, 'X');
    store().addOpponent(s2.id, 'Y');
    store().deleteTeam(t2.id);
    expect(store().seasons.map((x) => x.id)).toEqual([s1.id]);
    expect(store().opponents.map((o) => o.name)).toEqual(['X']);
    store().deleteProfile(profile.id);
    expect([store().seasons, store().opponents]).toEqual([[], []]);
  });

  it('migrates v8 data (v6.x app): one season per team, matches assigned', () => {
    const v8 = {
      teams: [
        { id: 't1', profileId: 'p', name: 'Herren', season: '2026/27', createdAt: '2026-01-01' },
      ],
      matches: [
        { id: 'm1', teamId: 't1', opponent: 'Rivals', date: '2026-11-01', home: true, sets: [] },
      ],
    };
    const up = migrateStore(v8, 8) as { seasons: unknown[]; matches: Record<string, unknown>[] };
    expect(up.seasons).toEqual([
      { id: 'season-t1', teamId: 't1', name: '2026/27', kind: 'season', createdAt: '2026-01-01' },
    ]);
    expect(up.matches[0]).toMatchObject({
      seasonId: 'season-t1',
      opponentId: 'opp-season-t1-rivals',
    });
  });
});
