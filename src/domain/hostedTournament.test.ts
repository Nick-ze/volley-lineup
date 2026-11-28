import {
  bestOfAllowed,
  emptyHosted,
  emptyTournamentForm,
  hostedOf,
  hostedOfProfiles,
  importHosted,
  isHostedConsistent,
  leadingSets,
  matchCount,
  matchEndChoices,
  matchEndFor,
  matchOutcome,
  MAX_HOSTED_TEAM_NAME_LENGTH,
  nextSetAllowed,
  nextTeamOrder,
  pairKey,
  parseScoreInput,
  readResultForm,
  resultCountOfTeam,
  resultOfPair,
  resultValidity,
  roundRobin,
  setInputError,
  setScoreError,
  setsSeenFrom,
  setsToWin,
  settingsChangeBlock,
  standings,
  tableCounts,
  teamMatches,
  teamsOfTournament,
  tournamentPlan,
  validateHostedTeamName,
  validateTournamentForm,
  visibleSetRows,
  withoutHostedTeam,
  withoutHostedTournament,
  type HostedData,
  type HostedSettings,
} from './hostedTournament';
import type {
  HostedResult,
  HostedSetScore,
  HostedTeam,
  HostedTournament,
  SetsPerMatch,
} from './types';

const BEST_OF_3: HostedSettings = { setsPerMatch: 3, matchEnd: 'bestOf' };
const ALL_2: HostedSettings = { setsPerMatch: 2, matchEnd: 'allSets' };
const ALL_3: HostedSettings = { setsPerMatch: 3, matchEnd: 'allSets' };

const set = (a: number, b: number): HostedSetScore => ({ a, b });

function tournament(extra: Partial<HostedTournament> = {}): HostedTournament {
  return {
    id: 'h1',
    profileId: 'pr1',
    name: 'Winter Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
    createdAt: '2026-11-28T10:00:00.000Z',
    ...extra,
  };
}

const team = (id: string, order: number, name = `Team ${id}`, tournamentId = 'h1'): HostedTeam => ({
  id,
  tournamentId,
  name,
  order,
});

const teams = (n: number): HostedTeam[] =>
  Array.from({ length: n }, (_, i) => team(`t${i + 1}`, i));

const result = (
  id: string,
  teamAId: string,
  teamBId: string,
  sets: HostedSetScore[],
  tournamentId = 'h1',
): HostedResult => ({ id, tournamentId, teamAId, teamBId, sets });

describe('roundRobin', () => {
  it('gives no round for fewer than two teams', () => {
    expect(roundRobin([])).toEqual([]);
    expect(roundRobin(['a'])).toEqual([]);
    expect(matchCount(0)).toBe(0);
    expect(matchCount(1)).toBe(0);
  });

  it('pairs two teams once', () => {
    expect(roundRobin(['a', 'b'])).toEqual([{ round: 1, pairs: [['a', 'b']], resting: null }]);
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 15, 16])('%i teams: every pair exactly once', (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const rounds = roundRobin(ids);
    const even = n % 2 === 0;
    expect(rounds).toHaveLength(even ? n - 1 : n);
    expect(rounds.map((r) => r.round)).toEqual(rounds.map((_, i) => i + 1));
    const keys = rounds.flatMap((r) => r.pairs.map(([a, b]) => pairKey(a, b)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(matchCount(n));
    for (const round of rounds) {
      // Nobody plays twice in a round; with an odd number exactly one team rests.
      const busy = round.pairs.flat();
      expect(new Set(busy).size).toBe(busy.length);
      expect(round.pairs).toHaveLength(Math.floor(n / 2));
      if (even) expect(round.resting).toBeNull();
      else expect([...busy, round.resting].sort()).toEqual([...ids].sort());
      // The first of a pair is the team added earlier.
      for (const [a, b] of round.pairs) expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(b));
    }
    if (!even) expect(new Set(rounds.map((r) => r.resting)).size).toBe(n);
  });

  it('follows the circle method for four teams', () => {
    expect(roundRobin(['a', 'b', 'c', 'd']).map((r) => r.pairs)).toEqual([
      [
        ['a', 'd'],
        ['b', 'c'],
      ],
      [
        ['a', 'c'],
        ['b', 'd'],
      ],
      [
        ['a', 'b'],
        ['c', 'd'],
      ],
    ]);
  });

  it('lets one of three teams rest per round', () => {
    expect(roundRobin(['a', 'b', 'c'])).toEqual([
      { round: 1, pairs: [['b', 'c']], resting: 'a' },
      { round: 2, pairs: [['a', 'c']], resting: 'b' },
      { round: 3, pairs: [['a', 'b']], resting: 'c' },
    ]);
  });
});

describe('teams and pairs', () => {
  it('orders a tournament’s teams by the order added, then by id', () => {
    const list = [team('b', 1), team('z', 0), team('a', 1), team('x', 0, 'Other', 'h2')];
    expect(teamsOfTournament(list, 'h1').map((t) => t.id)).toEqual(['z', 'a', 'b']);
    expect(nextTeamOrder(list, 'h1')).toBe(2);
    expect(nextTeamOrder(list, 'h3')).toBe(0);
  });

  it('finds a pair’s result whichever way round', () => {
    const results = [
      result('r1', 't1', 't2', [set(25, 20)]),
      result('r2', 't1', 't2', [set(1, 2)], 'h2'),
    ];
    expect(pairKey('b', 'a')).toBe(pairKey('a', 'b'));
    expect(resultOfPair(results, 'h1', 't2', 't1')?.id).toBe('r1');
    expect(resultOfPair(results, 'h1', 't1', 't3')).toBeUndefined();
    expect(setsSeenFrom(results[0], 't1')).toEqual([set(25, 20)]);
    expect(setsSeenFrom(results[0], 't2')).toEqual([set(20, 25)]);
    expect(resultCountOfTeam(results, 't2')).toBe(2);
    expect(resultCountOfTeam(results, 't9')).toBe(0);
  });
});

describe('settings', () => {
  it('offers best-of only for 1, 3 and 5 sets', () => {
    expect(([1, 2, 3, 4, 5] as SetsPerMatch[]).map(bestOfAllowed)).toEqual([
      true,
      false,
      true,
      false,
      true,
    ]);
    expect(matchEndChoices(3)).toEqual(['bestOf', 'allSets']);
    expect(matchEndChoices(4)).toEqual(['allSets']);
    expect(matchEndFor(2, 'bestOf')).toBe('allSets');
    expect(matchEndFor(5, 'bestOf')).toBe('bestOf');
    expect(matchEndFor(5, 'allSets')).toBe('allSets');
    expect(([1, 2, 3, 4, 5] as SetsPerMatch[]).map(setsToWin)).toEqual([1, 2, 2, 3, 3]);
  });

  it('says what the table counts', () => {
    expect(tableCounts(BEST_OF_3)).toBe('matches');
    expect(tableCounts(ALL_3)).toBe('sets');
  });
});

describe('set scores', () => {
  it('accepts two different whole numbers from 0 to 99', () => {
    expect(setScoreError(set(25, 23))).toBeNull();
    expect(setScoreError(set(0, 99))).toBeNull();
    expect(setScoreError(set(15, 15))).toBe('EQUAL');
    expect(setScoreError(set(100, 3))).toBe('RANGE');
    expect(setScoreError(set(3, 100))).toBe('RANGE');
    expect(setScoreError(set(-1, 3))).toBe('RANGE');
    expect(setScoreError(set(2.5, 3))).toBe('RANGE');
    expect(setScoreError(set(Number.NaN, 3))).toBe('RANGE');
  });

  it('reads typed scores', () => {
    expect(parseScoreInput('')).toBeNull();
    expect(parseScoreInput('  ')).toBeNull();
    expect(parseScoreInput(' 7 ')).toBe(7);
    expect(parseScoreInput('25')).toBe(25);
    expect(parseScoreInput('125')).toBeNaN();
    expect(parseScoreInput('2a')).toBeNaN();
    expect(parseScoreInput('-3')).toBeNaN();
  });
});

describe('matchOutcome', () => {
  it('is open without sets', () => {
    expect(matchOutcome([], BEST_OF_3)).toEqual({
      setsA: 0,
      setsB: 0,
      ballsA: 0,
      ballsB: 0,
      state: 'open',
      winner: null,
    });
  });

  it('best of 3 ends with the second set won', () => {
    expect(matchOutcome([set(25, 20)], BEST_OF_3)).toMatchObject({
      state: 'running',
      winner: null,
    });
    expect(matchOutcome([set(25, 20), set(20, 25)], BEST_OF_3)).toMatchObject({
      setsA: 1,
      setsB: 1,
      state: 'running',
    });
    expect(matchOutcome([set(25, 20), set(25, 22)], BEST_OF_3)).toEqual({
      setsA: 2,
      setsB: 0,
      ballsA: 50,
      ballsB: 42,
      state: 'done',
      winner: 'a',
    });
    expect(matchOutcome([set(25, 20), set(20, 25), set(13, 15)], BEST_OF_3)).toMatchObject({
      setsA: 1,
      setsB: 2,
      state: 'done',
      winner: 'b',
    });
  });

  it('best of 1 and best of 5', () => {
    expect(matchOutcome([set(21, 19)], { setsPerMatch: 1, matchEnd: 'bestOf' }).winner).toBe('a');
    const five: HostedSettings = { setsPerMatch: 5, matchEnd: 'bestOf' };
    expect(matchOutcome([set(25, 1), set(25, 1)], five).state).toBe('running');
    expect(matchOutcome([set(25, 1), set(25, 1), set(1, 25), set(25, 1)], five).winner).toBe('a');
  });

  it('all sets: over only when every set was played, a draw is possible', () => {
    expect(matchOutcome([set(25, 20)], ALL_2)).toMatchObject({ state: 'running', winner: null });
    expect(matchOutcome([set(25, 20), set(20, 25)], ALL_2)).toMatchObject({
      setsA: 1,
      setsB: 1,
      state: 'done',
      winner: 'draw',
    });
    expect(matchOutcome([set(25, 20), set(25, 20)], ALL_2).winner).toBe('a');
    expect(matchOutcome([set(20, 25), set(20, 25)], ALL_2).winner).toBe('b');
    // All three sets are played even after 2:0.
    expect(matchOutcome([set(25, 20), set(25, 20)], ALL_3).state).toBe('running');
    expect(matchOutcome([set(25, 20), set(25, 20), set(1, 25)], ALL_3)).toMatchObject({
      setsA: 2,
      setsB: 1,
      state: 'done',
      winner: 'a',
    });
  });

  it('counts an equal set for nobody (only reachable with bad data)', () => {
    expect(matchOutcome([set(10, 10)], ALL_2)).toMatchObject({ setsA: 0, setsB: 0, ballsA: 10 });
  });
});

describe('resultValidity and nextSetAllowed', () => {
  it('needs one to setsPerMatch valid sets', () => {
    expect(resultValidity([], BEST_OF_3)).toEqual({ ok: false, error: 'EMPTY' });
    expect(resultValidity([set(25, 20)], BEST_OF_3)).toEqual({ ok: true });
    expect(resultValidity([set(1, 0), set(1, 0), set(1, 0)], ALL_2)).toEqual({
      ok: false,
      error: 'TOO_MANY_SETS',
    });
    expect(resultValidity([set(25, 20), set(7, 7)], BEST_OF_3)).toEqual({
      ok: false,
      error: 'INVALID_SET',
      set: 2,
    });
  });

  it('refuses a set after the deciding one in best-of only', () => {
    const sets = [set(25, 20), set(25, 20), set(25, 20)];
    expect(resultValidity(sets, BEST_OF_3)).toEqual({
      ok: false,
      error: 'SET_AFTER_DECIDED',
      set: 3,
    });
    expect(resultValidity(sets, ALL_3)).toEqual({ ok: true });
    expect(resultValidity([set(25, 20), set(20, 25), set(15, 13)], BEST_OF_3)).toEqual({
      ok: true,
    });
  });

  it('allows the next set while the match is not over', () => {
    expect(nextSetAllowed([], BEST_OF_3)).toBe(true);
    expect(nextSetAllowed([set(25, 20)], BEST_OF_3)).toBe(true);
    expect(nextSetAllowed([set(25, 20), set(25, 20)], BEST_OF_3)).toBe(false);
    expect(nextSetAllowed([set(25, 20), set(20, 25)], BEST_OF_3)).toBe(true);
    expect(nextSetAllowed([set(25, 20), set(20, 25), set(15, 9)], BEST_OF_3)).toBe(false);
    expect(nextSetAllowed([set(25, 20), set(25, 20)], ALL_3)).toBe(true);
    expect(nextSetAllowed([set(25, 20), set(25, 20)], ALL_2)).toBe(false);
    expect(nextSetAllowed([set(7, 7)], BEST_OF_3)).toBe(false);
  });
});

describe('readResultForm', () => {
  const row = (a: string, b: string) => ({ a, b });

  it('reads the filled rows and drops empty ones at the end', () => {
    expect(readResultForm([row('25', '20'), row('20', '25'), row('', '')], BEST_OF_3)).toEqual({
      ok: true,
      sets: [set(25, 20), set(20, 25)],
    });
    expect(readResultForm([row('', ''), row(' ', '')], BEST_OF_3)).toEqual({ ok: true, sets: [] });
    expect(readResultForm([], BEST_OF_3)).toEqual({ ok: true, sets: [] });
  });

  it('reports rows that are incomplete, equal or out of range', () => {
    expect(
      readResultForm([row('25', ''), row('', ''), row('7', '7'), row('ab', '3')], ALL_3),
    ).toEqual({ ok: false, errors: { 0: 'INCOMPLETE', 1: 'INCOMPLETE', 2: 'EQUAL', 3: 'RANGE' } });
    expect(readResultForm([row('', '4')], ALL_3)).toEqual({
      ok: false,
      errors: { 0: 'INCOMPLETE' },
    });
  });

  it('reports a result the settings do not allow', () => {
    expect(readResultForm([row('25', '1'), row('25', '1'), row('25', '1')], BEST_OF_3)).toEqual({
      ok: false,
      errors: {},
      resultError: 'SET_AFTER_DECIDED',
    });
    expect(readResultForm([row('25', '1'), row('25', '1'), row('25', '1')], ALL_2)).toEqual({
      ok: false,
      errors: {},
      resultError: 'TOO_MANY_SETS',
    });
  });
});

describe('the result form while typing', () => {
  const row = (a: string, b: string) => ({ a, b });

  it('says what a complete row is missing, and nothing for an incomplete one', () => {
    expect(setInputError(row('25', '20'))).toBeNull();
    expect(setInputError(row('25', ''))).toBeNull();
    expect(setInputError(row('', '20'))).toBeNull();
    expect(setInputError(row('20', '20'))).toBe('EQUAL');
    expect(setInputError(row('x', '20'))).toBe('RANGE');
  });

  it('shows the first row, and the next one after every valid set until the match is over', () => {
    expect(visibleSetRows([], BEST_OF_3)).toBe(1);
    expect(visibleSetRows([row('', '')], BEST_OF_3)).toBe(1);
    expect(visibleSetRows([row('25', '')], BEST_OF_3)).toBe(1);
    expect(visibleSetRows([row('25', '25')], BEST_OF_3)).toBe(1);
    expect(visibleSetRows([row('25', '20')], BEST_OF_3)).toBe(2);
    // 1:1 in a best of 3: the third set can be played.
    expect(visibleSetRows([row('25', '20'), row('20', '25')], BEST_OF_3)).toBe(3);
    // 2:0: no third row, even when one was typed before.
    expect(visibleSetRows([row('25', '20'), row('25', '20'), row('15', '9')], BEST_OF_3)).toBe(2);
    expect(visibleSetRows([row('25', '20'), row('20', '25'), row('15', '9')], BEST_OF_3)).toBe(3);
    // All sets: every set is played, never more than the tournament has.
    expect(visibleSetRows([row('25', '20'), row('25', '20')], ALL_3)).toBe(3);
    expect(visibleSetRows([row('25', '20'), row('25', '20')], ALL_2)).toBe(2);
    expect(
      visibleSetRows([row('25', '20'), row('25', '20'), row('1', '2'), row('1', '2')], ALL_3),
    ).toBe(3);
    expect(visibleSetRows([row('21', '19')], { setsPerMatch: 1, matchEnd: 'bestOf' })).toBe(1);
  });

  it('counts the valid sets at the start of the rows', () => {
    expect(leadingSets([])).toEqual([]);
    expect(leadingSets([row('25', '20'), row('20', '25'), row('', '')])).toEqual([
      set(25, 20),
      set(20, 25),
    ]);
    expect(leadingSets([row('25', '20'), row('7', '7'), row('15', '9')])).toEqual([set(25, 20)]);
    expect(leadingSets([row('', '3')])).toEqual([]);
  });
});

describe('tournamentPlan', () => {
  it('joins the plan with the results', () => {
    const results = [
      // Stored the other way round: read from the pair's first team.
      result('r1', 't3', 't2', [set(20, 25), set(18, 25)]),
      result('r2', 't1', 't3', [set(25, 20)]),
      result('rx', 't1', 't2', [set(25, 0), set(25, 0)], 'other'),
    ];
    const plan = tournamentPlan(tournament(), [...teams(3), team('o1', 0, 'O', 'other')], results);
    expect(plan.teams.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(plan.total).toBe(3);
    expect(plan.played).toBe(1);
    expect(plan.rounds.map((r) => r.resting?.id)).toEqual(['t1', 't2', 't3']);
    const [first, second, third] = plan.rounds.map((r) => r.matches[0]);
    expect(first).toMatchObject({
      round: 1,
      teamA: { id: 't2' },
      teamB: { id: 't3' },
      sets: [set(25, 20), set(25, 18)],
      outcome: { state: 'done', winner: 'a', setsA: 2, setsB: 0 },
    });
    expect(first.result?.id).toBe('r1');
    expect(second).toMatchObject({ teamA: { id: 't1' }, outcome: { state: 'running' } });
    expect(third).toMatchObject({ result: undefined, sets: [], outcome: { state: 'open' } });
  });

  it('has no rounds and no resting team for an even number without results', () => {
    const plan = tournamentPlan(tournament(), teams(2), []);
    expect(plan).toMatchObject({ total: 1, played: 0 });
    expect(plan.rounds[0].resting).toBeNull();
    expect(tournamentPlan(tournament(), teams(1), [])).toMatchObject({ rounds: [], total: 0 });
  });
});

describe('standings', () => {
  it('best of: 2 per win, then set difference, ball difference, balls scored', () => {
    const list = teams(4);
    const results = [
      result('r1', 't1', 't2', [set(25, 20), set(25, 20)]), // t1 2:0
      result('r2', 't3', 't4', [set(25, 23), set(23, 25), set(15, 13)]), // t3 2:1
      result('r3', 't1', 't3', [set(25, 10), set(20, 25), set(15, 10)]), // t1 2:1
      result('r4', 't2', 't4', [set(25, 5), set(25, 5)]), // t2 2:0
      result('r5', 't1', 't4', [set(25, 20)]), // running: doesn't count
    ];
    const table = standings(tournament(), list, results);
    expect(table.map((s) => [s.rank, s.team.id, s.points])).toEqual([
      [1, 't1', 4],
      [2, 't2', 2], // sets 2:2, balls +30
      [3, 't3', 2], // sets 3:3
      [4, 't4', 0],
    ]);
    expect(table[0]).toMatchObject({
      played: 2,
      won: 2,
      drawn: 0,
      lost: 0,
      setsFor: 4,
      setsAgainst: 1,
      ballsFor: 110,
      ballsAgainst: 85,
    });
    expect(table[3]).toMatchObject({ played: 2, won: 0, lost: 2, setsFor: 1, setsAgainst: 4 });
  });

  it('breaks a tie in points by set difference, then ball difference, then balls scored', () => {
    const list = teams(4);
    const base = tournament({ setsPerMatch: 1 });
    // t1 beats t2, t3 beats t4: both winners 2 points, 1:0 sets.
    const bySets = standings(tournament(), list, [
      result('r1', 't1', 't2', [set(25, 20), set(20, 25), set(15, 10)]),
      result('r2', 't3', 't4', [set(25, 20), set(25, 20)]),
    ]);
    expect(bySets.map((s) => s.team.id)).toEqual(['t3', 't1', 't2', 't4']);
    const byBallDiff = standings(base, list, [
      result('r1', 't1', 't2', [set(25, 20)]),
      result('r2', 't3', 't4', [set(25, 10)]),
    ]);
    expect(byBallDiff.map((s) => [s.rank, s.team.id])).toEqual([
      [1, 't3'],
      [2, 't1'],
      [3, 't2'],
      [4, 't4'],
    ]);
    const byBalls = standings(base, list, [
      result('r1', 't1', 't2', [set(15, 10)]),
      result('r2', 't3', 't4', [set(25, 20)]),
    ]);
    expect(byBalls.map((s) => [s.rank, s.team.id])).toEqual([
      [1, 't3'],
      [2, 't1'],
      [3, 't4'],
      [4, 't2'],
    ]);
  });

  it('teams equal in all four share a rank and are listed by name, then by order', () => {
    const list = [
      team('t1', 0, 'Zebras'),
      team('t2', 1, 'Adler'),
      team('t3', 2, 'adler'),
      team('t4', 3, 'Mitte'),
    ];
    const none = standings(tournament(), list, []);
    expect(none.map((s) => [s.rank, s.team.id])).toEqual([
      [1, 't2'],
      [1, 't3'],
      [1, 't4'],
      [1, 't1'],
    ]);
    const some = standings(tournament({ setsPerMatch: 1 }), list, [
      result('r1', 't1', 't2', [set(25, 20)]),
      result('r2', 't3', 't4', [set(25, 20)]),
    ]);
    expect(some.map((s) => [s.rank, s.team.id])).toEqual([
      [1, 't3'],
      [1, 't1'],
      [3, 't2'],
      [3, 't4'],
    ]);
  });

  it('all sets: 1 per set won, with draws', () => {
    const list = teams(3);
    const table = standings(tournament({ setsPerMatch: 2, matchEnd: 'allSets' }), list, [
      result('r1', 't1', 't2', [set(25, 20), set(20, 25)]), // draw
      result('r2', 't1', 't3', [set(25, 20), set(25, 20)]), // t1 2:0
      result('r3', 't2', 't3', [set(25, 20)]), // one of two sets: running, doesn't count
    ]);
    expect(table.map((s) => [s.rank, s.team.id, s.points])).toEqual([
      [1, 't1', 3],
      [2, 't2', 1],
      [3, 't3', 0],
    ]);
    expect(table[0]).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0 });
    expect(table[1]).toMatchObject({ played: 1, won: 0, drawn: 1, lost: 0 });
    expect(table[2]).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1 });
  });

  it('an odd number of teams: everyone is in the table', () => {
    const table = standings(tournament(), teams(5), [
      result('r1', 't2', 't5', [set(25, 20), set(25, 20)]),
    ]);
    expect(table).toHaveLength(5);
    expect(table[0].team.id).toBe('t2');
    expect(table[4].team.id).toBe('t5');
    expect(table.slice(1, 4).map((s) => s.rank)).toEqual([2, 2, 2]);
  });

  it('is empty without teams', () => {
    expect(standings(tournament(), [], [])).toEqual([]);
  });
});

describe('teamMatches', () => {
  it('lists a team’s matches in plan order', () => {
    const plan = tournamentPlan(tournament(), teams(4), [
      result('r1', 't1', 't4', [set(25, 20), set(25, 20)]),
    ]);
    const mine = teamMatches('t4', plan);
    expect(mine.map((m) => [m.round, m.opponent.id])).toEqual([
      [1, 't1'],
      [2, 't2'],
      [3, 't3'],
    ]);
    expect(mine[0].match.outcome.winner).toBe('a');
    expect(teamMatches('t1', plan).map((m) => m.opponent.id)).toEqual(['t4', 't3', 't2']);
    expect(teamMatches('nobody', plan)).toEqual([]);
  });
});

describe('validateTournamentForm', () => {
  const existing = [tournament(), tournament({ id: 'h2', profileId: 'pr2', name: 'Other' })];
  const input = (extra: Partial<ReturnType<typeof emptyTournamentForm>> = {}) => ({
    ...emptyTournamentForm(),
    name: 'Sommer-Cup',
    ...extra,
  });

  it('starts with 3 sets, best of 3', () => {
    expect(emptyTournamentForm()).toEqual({
      name: '',
      date: '',
      location: '',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
  });

  it('accepts a name alone and leaves blank optional fields out', () => {
    expect(validateTournamentForm(input({ name: '  Sommer-Cup ' }), existing, 'pr1')).toEqual({
      ok: true,
      value: { name: 'Sommer-Cup', setsPerMatch: 3, matchEnd: 'bestOf' },
    });
  });

  it('stores the date as ISO and the place trimmed', () => {
    const value = validateTournamentForm(
      input({ date: '5.12.26', location: ' Halle Süd ', setsPerMatch: 5, matchEnd: 'allSets' }),
      existing,
      'pr1',
    );
    expect(value).toEqual({
      ok: true,
      value: {
        name: 'Sommer-Cup',
        date: '2026-12-05',
        location: 'Halle Süd',
        setsPerMatch: 5,
        matchEnd: 'allSets',
      },
    });
  });

  it('forces "all sets" with 2 or 4 sets', () => {
    const value = validateTournamentForm(input({ setsPerMatch: 4 }), existing, 'pr1');
    expect(value).toMatchObject({ ok: true, value: { setsPerMatch: 4, matchEnd: 'allSets' } });
  });

  it('reports every faulty field', () => {
    expect(
      validateTournamentForm(
        input({ name: ' ', date: '31.02.26', location: 'x'.repeat(81) }),
        existing,
        'pr1',
      ),
    ).toEqual({
      ok: false,
      errors: { name: 'REQUIRED', date: 'INVALID_DATE', location: 'TOO_LONG' },
    });
    expect(validateTournamentForm(input({ name: 'x'.repeat(41) }), existing, 'pr1')).toEqual({
      ok: false,
      errors: { name: 'TOO_LONG' },
    });
  });

  it('wants a name that is unique within the profile, ignoring case', () => {
    expect(validateTournamentForm(input({ name: 'winter cup' }), existing, 'pr1')).toEqual({
      ok: false,
      errors: { name: 'DUPLICATE' },
    });
    // The tournament being edited, and another profile's tournament, don't count.
    expect(validateTournamentForm(input({ name: 'winter cup' }), existing, 'pr1', 'h1').ok).toBe(
      true,
    );
    expect(validateTournamentForm(input({ name: 'Other' }), existing, 'pr1').ok).toBe(true);
  });
});

describe('validateHostedTeamName', () => {
  const list = [team('t1', 0, 'TV Nord'), team('t2', 1, 'Rivals'), team('x', 0, 'Elsewhere', 'h2')];

  it('trims and accepts a new name', () => {
    expect(validateHostedTeamName('  SC   Blau ', list, 'h1')).toEqual({
      ok: true,
      name: 'SC Blau',
    });
    expect(validateHostedTeamName('Elsewhere', list, 'h1').ok).toBe(true);
  });

  it('refuses blank, long and duplicate names', () => {
    expect(validateHostedTeamName('  ', list, 'h1')).toEqual({ ok: false, error: 'REQUIRED' });
    expect(validateHostedTeamName('x'.repeat(MAX_HOSTED_TEAM_NAME_LENGTH + 1), list, 'h1')).toEqual(
      { ok: false, error: 'TOO_LONG' },
    );
    expect(validateHostedTeamName('tv nord', list, 'h1')).toEqual({
      ok: false,
      error: 'DUPLICATE',
    });
  });

  it('lets a team keep its name when renamed', () => {
    expect(validateHostedTeamName('TV NORD', list, 'h1', 't1')).toEqual({
      ok: true,
      name: 'TV NORD',
    });
    expect(validateHostedTeamName('Rivals', list, 'h1', 't1')).toEqual({
      ok: false,
      error: 'DUPLICATE',
    });
  });

  it('refuses a 17th team but still renames one of 16', () => {
    const full = teams(16);
    expect(validateHostedTeamName('One more', full, 'h1')).toEqual({
      ok: false,
      error: 'TOO_MANY',
    });
    expect(validateHostedTeamName('Renamed', full, 'h1', 't3').ok).toBe(true);
    expect(validateHostedTeamName('Fits', teams(15), 'h1').ok).toBe(true);
  });
});

describe('settingsChangeBlock', () => {
  const list = teams(3);
  const results = [
    result('r1', 't2', 't3', [set(25, 20), set(25, 20), set(20, 25)]),
    result('r2', 't1', 't2', [set(25, 20), set(20, 25)]),
  ];

  it('allows a change that keeps every result valid', () => {
    expect(settingsChangeBlock('h1', ALL_3, list, results)).toBeNull();
    expect(
      settingsChangeBlock('h1', { setsPerMatch: 5, matchEnd: 'allSets' }, list, results),
    ).toBeNull();
    expect(settingsChangeBlock('h1', BEST_OF_3, list, [results[1]])).toBeNull();
    expect(settingsChangeBlock('h1', ALL_2, list, [])).toBeNull();
  });

  it('names the first match with more sets than the new number', () => {
    const block = settingsChangeBlock('h1', ALL_2, list, results);
    expect(block?.error).toBe('TOO_MANY_SETS');
    expect([block?.match.teamA.id, block?.match.teamB.id]).toEqual(['t2', 't3']);
    expect(block?.match.sets).toHaveLength(3);
  });

  it('names the match with a set after the deciding one', () => {
    const block = settingsChangeBlock('h1', BEST_OF_3, list, results);
    expect(block?.error).toBe('SET_AFTER_DECIDED');
    expect(block?.match.result?.id).toBe('r1');
    // Fewer sets than a result has, with best of 1.
    expect(
      settingsChangeBlock('h1', { setsPerMatch: 1, matchEnd: 'bestOf' }, list, [results[1]])?.error,
    ).toBe('TOO_MANY_SETS');
  });

  it('names a result whose set is invalid', () => {
    const bad = [result('r1', 't1', 't2', [set(7, 7)])];
    expect(settingsChangeBlock('h1', ALL_3, list, bad)?.error).toBe('INVALID_SET');
  });
});

describe('hosted data', () => {
  const profiles = new Set(['pr1', 'pr2']);
  const data = (): HostedData => ({
    hostedTournaments: [tournament(), tournament({ id: 'h2', profileId: 'pr2', name: 'Other' })],
    hostedTeams: [...teams(3), team('o1', 0, 'O1', 'h2'), team('o2', 1, 'O2', 'h2')],
    hostedResults: [
      result('r1', 't1', 't2', [set(25, 20), set(25, 20)]),
      result('r2', 'o1', 'o2', [set(25, 20)], 'h2'),
    ],
  });

  it('reads the collections of anything, empty when missing', () => {
    expect(emptyHosted()).toEqual({ hostedTournaments: [], hostedTeams: [], hostedResults: [] });
    expect(hostedOf({})).toEqual(emptyHosted());
    const full = { ...data(), profiles: [] };
    expect(hostedOf(full)).toEqual(data());
  });

  it('accepts consistent data', () => {
    expect(isHostedConsistent(emptyHosted(), new Set())).toBe(true);
    expect(isHostedConsistent(data(), profiles)).toBe(true);
  });

  it.each<[string, (d: HostedData) => void]>([
    ['a duplicate tournament id', (d) => d.hostedTournaments.push(tournament())],
    ['a duplicate team id', (d) => d.hostedTeams.push(team('t1', 9))],
    ['a duplicate result id', (d) => d.hostedResults.push(result('r1', 't2', 't3', [set(1, 0)]))],
    ['an unknown profile', (d) => (d.hostedTournaments[0].profileId = 'nobody')],
    ['best of with 2 sets', (d) => (d.hostedTournaments[1].setsPerMatch = 2)],
    ['a team without tournament', (d) => d.hostedTeams.push(team('t9', 0, 'Lost', 'h9'))],
    [
      'a result without tournament',
      (d) => d.hostedResults.push(result('r9', 't1', 't3', [set(1, 0)], 'h9')),
    ],
    ['a result of one team', (d) => d.hostedResults.push(result('r9', 't3', 't3', [set(1, 0)]))],
    ['an unknown team A', (d) => d.hostedResults.push(result('r9', 'tx', 't3', [set(1, 0)]))],
    [
      'a team B of another tournament',
      (d) => d.hostedResults.push(result('r9', 't3', 'o1', [set(1, 0)])),
    ],
    ['an invalid set', (d) => d.hostedResults.push(result('r9', 't2', 't3', [set(5, 5)]))],
    [
      'a set after the deciding one',
      (d) => d.hostedResults.push(result('r9', 't2', 't3', [set(1, 0), set(1, 0), set(1, 0)])),
    ],
    [
      'two results for one pair',
      (d) => d.hostedResults.push(result('r9', 't2', 't1', [set(1, 0)])),
    ],
  ])('refuses %s', (_name, change) => {
    const d = data();
    change(d);
    expect(isHostedConsistent(d, profiles)).toBe(false);
  });

  it('keeps only the tournaments of the given profiles', () => {
    const kept = hostedOfProfiles(data(), new Set(['pr2']));
    expect(kept.hostedTournaments.map((x) => x.id)).toEqual(['h2']);
    expect(kept.hostedTeams.map((x) => x.id)).toEqual(['o1', 'o2']);
    expect(kept.hostedResults.map((x) => x.id)).toEqual(['r2']);
  });

  it('removes a tournament with its teams and results', () => {
    const kept = withoutHostedTournament(data(), 'h1');
    expect(kept).toEqual(hostedOfProfiles(data(), new Set(['pr2'])));
  });

  it('removes a team with its results', () => {
    const kept = withoutHostedTeam(data(), 't2');
    expect(kept.hostedTournaments).toHaveLength(2);
    expect(kept.hostedTeams.map((x) => x.id)).toEqual(['t1', 't3', 'o1', 'o2']);
    expect(kept.hostedResults.map((x) => x.id)).toEqual(['r2']);
    expect(withoutHostedTeam(data(), 't1').hostedResults.map((x) => x.id)).toEqual(['r2']);
  });

  describe('importHosted', () => {
    it('replace takes the file’s tournaments of the remaining profiles', () => {
      const file = data();
      expect(importHosted(emptyHosted(), file, 'replace', profiles)).toEqual({
        ok: true,
        hosted: file,
      });
      const onlyOne = importHosted(data(), file, 'replace', new Set(['pr1']));
      expect(onlyOne.ok && onlyOne.hosted.hostedTournaments.map((x) => x.id)).toEqual(['h1']);
    });

    it('merge matches by id, the file wins, the rest stays', () => {
      const file: HostedData = {
        hostedTournaments: [
          tournament({ name: 'Winter Cup 2' }),
          tournament({ id: 'h3', name: 'New' }),
        ],
        hostedTeams: [team('t1', 0, 'Renamed'), team('n1', 0, 'N1', 'h3')],
        hostedResults: [result('r1', 't1', 't2', [set(20, 25), set(20, 25)])],
      };
      const merged = importHosted(data(), file, 'merge', profiles);
      expect(merged.ok).toBe(true);
      if (!merged.ok) return;
      expect(merged.hosted.hostedTournaments.map((x) => [x.id, x.name])).toEqual([
        ['h1', 'Winter Cup 2'],
        ['h2', 'Other'],
        ['h3', 'New'],
      ]);
      expect(merged.hosted.hostedTeams.map((x) => x.id)).toEqual([
        't1',
        't2',
        't3',
        'o1',
        'o2',
        'n1',
      ]);
      expect(merged.hosted.hostedTeams[0].name).toBe('Renamed');
      expect(merged.hosted.hostedResults.map((x) => [x.id, x.sets[0]])).toEqual([
        ['r1', set(20, 25)],
        ['r2', set(25, 20)],
      ]);
    });

    it('merge: the file’s result of a pair replaces the device’s under another id', () => {
      const file: HostedData = {
        ...emptyHosted(),
        hostedResults: [result('other-id', 't2', 't1', [set(25, 0), set(25, 0)])],
      };
      const merged = importHosted(data(), file, 'merge', profiles);
      expect(merged.ok && merged.hosted.hostedResults.map((x) => x.id)).toEqual(['r2', 'other-id']);
    });

    it('merge refuses a combination that does not fit together', () => {
      // The file makes the tournament one set long; the device's result has two.
      const file: HostedData = {
        ...emptyHosted(),
        hostedTournaments: [tournament({ setsPerMatch: 1 })],
      };
      expect(importHosted(data(), file, 'merge', profiles)).toEqual({
        ok: false,
        error: 'MERGE_CONFLICT',
      });
    });

    it('merge drops tournaments of profiles that are gone', () => {
      const merged = importHosted(data(), emptyHosted(), 'merge', new Set(['pr1']));
      expect(merged.ok && merged.hosted.hostedTournaments.map((x) => x.id)).toEqual(['h1']);
    });
  });
});
