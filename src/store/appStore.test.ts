import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildExport, parseImport } from '@/domain/exportSchema';
import { emptySetLineup } from '@/domain/lineup';

import { STORAGE_KEY, emptyData, selectAppData, useAppStore } from './appStore';
import { migrateStore, STORE_VERSION } from './migrations';
import {
  selectCurrentProfile,
  selectMatchesForTeam,
  selectPlayersForTeam,
  selectPresetsForTeam,
  selectStarters,
  selectTeamsForProfile,
} from './selectors';

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
    const text = JSON.stringify(buildExport(selectAppData(store())));
    expect(parseImport(text).ok).toBe(true);
  });

  it('deleting an unknown player is a no-op', () => {
    seed();
    const before = store().matches;
    store().deletePlayer('nope');
    expect(store().matches).toBe(before);
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
    const text = JSON.stringify(buildExport(selectAppData(store())));
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
});

describe('migrations', () => {
  it('passes current data through and rejects newer versions', () => {
    expect(migrateStore({ a: 1 }, STORE_VERSION)).toEqual({ a: 1 });
    expect(() => migrateStore({}, STORE_VERSION + 1)).toThrow();
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
    expect(migrateStore(v1, 1)).toEqual({
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
            },
            'junk',
          ],
        },
        'junk',
        { id: 'm2' },
      ],
    });
    expect(migrateStore({ matches: 'x' }, 1)).toEqual({
      chipLabel: 'number',
      presets: [],
      language: 'en',
      matches: 'x',
    });
    expect(migrateStore(null, 1)).toBeNull();
  });

  it('upgrades v2 data: the state gains an empty preset list', () => {
    const v2 = { profiles: [], matches: [], language: 'de' };
    expect(migrateStore(v2, 2)).toEqual({
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
    // v3 → v4 changes nothing; v4 → v5 only adds the chip setting.
    expect(migrateStore(v3, 3)).toEqual({ ...v3, chipLabel: 'number' });
  });

  it('upgrades v4 data (v3.0 app): player chips keep showing numbers', () => {
    const v4 = { profiles: [], presets: [], matches: [], language: 'de' };
    expect(migrateStore(v4, 4)).toEqual({ ...v4, chipLabel: 'number' });
    expect(migrateStore(null, 4)).toBeNull();
    expect(STORE_VERSION).toBe(5);
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
