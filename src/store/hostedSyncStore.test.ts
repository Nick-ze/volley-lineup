/**
 * v12.4 (store v17): what sharing a hosted tournament needs from the store — ids two devices
 * agree on, the time an own match was added, and the links of shared tournaments going with
 * what they belong to.
 */
import { emptyLink, tournamentLinks, withTournamentLink } from '@/domain/hostedSync';
import { resetStores } from '@/test-utils';

import { selectAppData, useAppStore } from './appStore';

const store = () => useAppStore.getState();
const links = () => Object.keys(tournamentLinks(store().sync));

beforeEach(() => resetStores());

function seed(plan: 'roundRobin' | 'manual' = 'roundRobin') {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  const cup = store().addHostedTournament({
    profileId: coach.id,
    name: 'Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
    plan,
  });
  const a = store().addHostedTeam(cup.id, 'A');
  const b = store().addHostedTeam(cup.id, 'B');
  return { coach, cup, a, b };
}

/** Marks the tournament as shared (as the sync engine does). */
const link = (tournamentId: string) =>
  store().syncTransaction((s) => ({
    sync: withTournamentLink(s.sync, tournamentId, emptyLink('u1', 'host')),
  }));

const SETS = [
  { a: 25, b: 20 },
  { a: 25, b: 22 },
];

describe('ids of a round robin’s results', () => {
  it('a typed-in result of a pair gets the pair’s id, whichever team is named first', () => {
    const { cup, a, b } = seed();
    const [low, high] = [a.id, b.id].sort();
    store().setHostedResult(cup.id, b.id, a.id, SETS);
    expect(store().hostedResults.map((r) => r.id)).toEqual([`pair-${low}-${high}`]);
    // Changing it keeps the id.
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 1 }]);
    expect(store().hostedResults.map((r) => r.id)).toEqual([`pair-${low}-${high}`]);
  });

  it('a result that starts with live scoring gets the same id', () => {
    const { cup, a, b } = seed();
    const [low, high] = [a.id, b.id].sort();
    store().saveHostedLive(
      { tournamentId: cup.id, teamAId: b.id, teamBId: a.id },
      { sets: [], live: [[{ team: 'a' }]] },
    );
    expect(store().hostedResults.map((r) => r.id)).toEqual([`pair-${low}-${high}`]);
  });

  it('a result stored before 12.4 keeps the id it has', () => {
    const { cup, a, b } = seed();
    useAppStore.setState({
      hostedResults: [
        { id: 'old', tournamentId: cup.id, teamAId: a.id, teamBId: b.id, sets: SETS },
      ],
    });
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 1 }]);
    expect(store().hostedResults.map((r) => r.id)).toEqual(['old']);
  });
});

describe('the time an own match was added', () => {
  it('is set when the match is added and kept when its result changes', () => {
    jest.useFakeTimers({ now: new Date('2026-11-28T15:00:00.000Z') });
    try {
      const { cup, a, b } = seed('manual');
      const match = store().addHostedMatch(cup.id, a.id, b.id);
      expect(match?.addedAt).toBe('2026-11-28T15:00:00.000Z');
      const id = match?.id as string;
      store().setHostedMatchSets(id, SETS);
      expect(store().hostedResults[0]).toMatchObject({ sets: SETS, addedAt: match?.addedAt });
      store().saveHostedLive({ matchId: id }, { sets: [], live: [[{ team: 'b' }]] });
      expect(store().hostedResults[0]).toMatchObject({ sets: [], addedAt: match?.addedAt });
      store().clearHostedLive(id);
      expect(store().hostedResults[0].addedAt).toBe(match?.addedAt);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a match without one (not yet upgraded) stays without when its result changes', () => {
    const { cup, a, b } = seed('manual');
    useAppStore.setState({
      hostedResults: [{ id: 'm1', tournamentId: cup.id, teamAId: a.id, teamBId: b.id, sets: [] }],
    });
    store().setHostedMatchSets('m1', SETS);
    store().saveHostedLive({ matchId: 'm1' }, { sets: SETS, live: [[], [], [{ team: 'a' }]] });
    expect('addedAt' in store().hostedResults[0]).toBe(false);
  });
});

describe('links of shared tournaments', () => {
  it('go with the tournament when it is deleted', () => {
    const { cup } = seed();
    link(cup.id);
    expect(links()).toEqual([cup.id]);
    store().deleteHostedTournament(cup.id);
    expect(links()).toEqual([]);
    expect(store().hostedTournaments).toEqual([]);
  });

  it('go with the profile, and stay when another profile is deleted', () => {
    const { coach, cup } = seed();
    const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
    link(cup.id);
    store().deleteProfile(other.id);
    expect(links()).toEqual([cup.id]);
    store().deleteProfile(coach.id);
    expect(links()).toEqual([]);
  });

  it('go with "Delete all data"', () => {
    const { cup } = seed();
    link(cup.id);
    store().resetAll();
    expect(links()).toEqual([]);
  });

  it('an import keeps the device’s copy of a shared tournament', () => {
    const { cup, a, b } = seed();
    store().setHostedResult(cup.id, a.id, b.id, SETS);
    link(cup.id);
    const before = selectAppData(store());
    // The file has the tournament under another name, without its teams and result.
    store().replaceAll({
      ...before,
      hostedTournaments: [{ ...before.hostedTournaments[0], name: 'From the file' }],
      hostedTeams: [],
      hostedResults: [],
    });
    expect(store().hostedTournaments[0].name).toBe('Cup');
    expect(store().hostedTeams).toHaveLength(2);
    expect(store().hostedResults).toHaveLength(1);
    expect(links()).toEqual([cup.id]);
  });

  it('an import without the tournament’s profile removes the tournament and its link', () => {
    const { cup } = seed();
    link(cup.id);
    const before = selectAppData(store());
    store().replaceAll({ ...before, profiles: [], hostedTournaments: [], hostedTeams: [] });
    expect(store().hostedTournaments).toEqual([]);
    expect(links()).toEqual([]);
  });

  it('an import replaces a tournament that isn’t shared, as before', () => {
    const { cup } = seed();
    const before = selectAppData(store());
    store().replaceAll({
      ...before,
      hostedTournaments: [{ ...before.hostedTournaments[0], name: 'From the file' }],
    });
    expect(store().hostedTournaments[0]).toMatchObject({ id: cup.id, name: 'From the file' });
  });
});
