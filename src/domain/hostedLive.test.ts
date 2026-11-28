/**
 * v12.2: a hosted team's optional players, live scoring of a hosted match, and the rules for
 * both in stored data.
 */
import {
  addPoint,
  addStats,
  emptyHosted,
  endSet,
  flippedState,
  hasLiveDetails,
  hasTags,
  importHosted,
  isHostedConsistent,
  lastPoint,
  liveStateOf,
  liveStats,
  liveStatus,
  MAX_HOSTED_PLAYERS,
  playerLabelOf,
  playerRef,
  playersOfTeam,
  runningPoints,
  runningScore,
  scoreOf,
  storedLive,
  tagLastPoint,
  tagSide,
  teamLiveStats,
  tournamentPlan,
  undoLast,
  validateHostedPlayer,
  withoutHostedPlayer,
  withoutHostedTeam,
  withoutHostedTournament,
  type HostedData,
  type HostedSettings,
  type LiveState,
} from './hostedTournament';
import type { HostedPlayer, HostedPoint, HostedResult, HostedTournament } from './types';

const BEST_OF_3: HostedSettings = { setsPerMatch: 3, matchEnd: 'bestOf' };
const ALL_2: HostedSettings = { setsPerMatch: 2, matchEnd: 'allSets' };
const EMPTY: LiveState = { sets: [], live: [] };

const a = (extra: Partial<HostedPoint> = {}): HostedPoint => ({ team: 'a', ...extra });
const b = (extra: Partial<HostedPoint> = {}): HostedPoint => ({ team: 'b', ...extra });
/** Scores points in order: "aab" → a, a, b. */
const play = (state: LiveState, order: string, settings = BEST_OF_3): LiveState =>
  [...order].reduce((s, team) => addPoint(s, team as 'a' | 'b', settings), state);

describe('players of a hosted team', () => {
  const player = (id: string, extra: Partial<HostedPlayer> = {}, teamId = 't1'): HostedPlayer => ({
    id,
    teamId,
    ...extra,
  });
  const number = (n: number) => `#${n}`;

  it('go by number unless the team says by name', () => {
    expect(playerLabelOf({})).toBe('number');
    expect(playerLabelOf({ playerLabel: 'name' })).toBe('name');
    expect(playerLabelOf({ playerLabel: 'number' })).toBe('number');
  });

  it('are named by what the team asks for, with the other as a fallback', () => {
    const kelly = { number: 6, name: 'Kelly' };
    expect(playerRef(kelly, 'number', number)).toEqual({ short: '#6', full: '#6 Kelly' });
    expect(playerRef(kelly, 'name', number)).toEqual({ short: 'Kelly', full: '#6 Kelly' });
    expect(playerRef({ number: 9 }, 'name', number)).toEqual({ short: '#9', full: '#9' });
    expect(playerRef({ name: 'Mia' }, 'number', number)).toEqual({ short: 'Mia', full: 'Mia' });
    expect(playerRef({ number: 0 }, 'number', number).short).toBe('#0');
  });

  it('are listed by number, those without one last by name, then as added', () => {
    const list = [
      player('x', { name: 'Zoe' }),
      player('y', { number: 11 }),
      player('z', { number: 4, name: 'Jonas' }),
      player('w', { name: 'Anna 10' }),
      player('v', { name: 'Anna 2' }),
      player('u', { name: 'Zoe' }),
      // the same number twice (a merged file can bring that): the one without a name first
      player('s', { number: 11, name: 'Late' }),
      player('other', { number: 1 }, 't2'),
    ];
    expect(playersOfTeam(list, 't1').map((p) => p.id)).toEqual(['z', 'y', 's', 'v', 'w', 'x', 'u']);
    expect(playersOfTeam(list, 'nope')).toEqual([]);
  });

  describe('validateHostedPlayer', () => {
    const list = [player('p1', { number: 6, name: 'Kelly' }), player('p2', { number: 9 }, 't2')];

    it('wants a number, a name, or both', () => {
      expect(validateHostedPlayer({ number: ' 7 ', name: '  Ana   Maria ' }, list, 't1')).toEqual({
        ok: true,
        value: { number: 7, name: 'Ana Maria' },
      });
      expect(validateHostedPlayer({ number: '0', name: '' }, list, 't1')).toEqual({
        ok: true,
        value: { number: 0 },
      });
      expect(validateHostedPlayer({ number: '', name: 'Mia' }, list, 't1')).toEqual({
        ok: true,
        value: { name: 'Mia' },
      });
      expect(validateHostedPlayer({ number: ' ', name: ' ' }, list, 't1')).toEqual({
        ok: false,
        error: 'REQUIRED',
      });
    });

    it('refuses a number that is not a whole number up to 999, and a name that is too long', () => {
      for (const bad of ['1000', '-1', '7a', '1.5']) {
        expect(validateHostedPlayer({ number: bad, name: 'X' }, list, 't1')).toEqual({
          ok: false,
          error: 'INVALID_NUMBER',
        });
      }
      expect(validateHostedPlayer({ number: '999', name: '' }, list, 't1').ok).toBe(true);
      expect(validateHostedPlayer({ number: '', name: 'x'.repeat(201) }, list, 't1')).toEqual({
        ok: false,
        error: 'TOO_LONG',
      });
    });

    it('refuses a number another player of the team has', () => {
      expect(validateHostedPlayer({ number: '6', name: '' }, list, 't1')).toEqual({
        ok: false,
        error: 'DUPLICATE_NUMBER',
      });
      // another team's number, and the player's own number when edited, are fine
      expect(validateHostedPlayer({ number: '9', name: '' }, list, 't1').ok).toBe(true);
      expect(validateHostedPlayer({ number: '6', name: 'K.' }, list, 't1', 'p1').ok).toBe(true);
      // two players without a number may share a name
      expect(validateHostedPlayer({ number: '', name: 'Kelly' }, list, 't1').ok).toBe(true);
    });

    it('refuses a 31st player but still edits one of 30', () => {
      const full = Array.from({ length: MAX_HOSTED_PLAYERS }, (_, i) =>
        player(`p${i}`, { number: i }),
      );
      expect(validateHostedPlayer({ number: '99', name: '' }, full, 't1')).toEqual({
        ok: false,
        error: 'TOO_MANY',
      });
      expect(validateHostedPlayer({ number: '99', name: '' }, full, 't1', 'p3').ok).toBe(true);
    });
  });
});

describe('live scoring', () => {
  it('starts from nothing, or from a stored result', () => {
    expect(liveStateOf(undefined)).toEqual(EMPTY);
    // typed-in sets have no rallies: an empty list stands for each
    expect(liveStateOf({ sets: [{ a: 25, b: 20 }] })).toEqual({
      sets: [{ a: 25, b: 20 }],
      live: [[]],
    });
    const stored = { sets: [{ a: 2, b: 1 }], live: [[a(), a(), b()], [a()]] };
    expect(liveStateOf(stored)).toEqual(stored);
  });

  it('counts a list of rallies', () => {
    expect(scoreOf([])).toEqual({ a: 0, b: 0 });
    expect(scoreOf([a(), b(), a()])).toEqual({ a: 2, b: 1 });
  });

  it('before the first point: set 1, 0:0, nothing to end or undo', () => {
    expect(liveStatus(EMPTY, BEST_OF_3)).toEqual({
      phase: 'between',
      setNumber: 1,
      score: { a: 0, b: 0 },
      setsA: 0,
      setsB: 0,
      canScore: true,
      canEndSet: false,
      canUndo: false,
    });
    expect(runningPoints(EMPTY)).toBeNull();
    expect(runningScore(EMPTY)).toBeNull();
    expect(lastPoint(EMPTY)).toBeNull();
  });

  it('scores point by point; the set can end once the scores differ', () => {
    let state = play(EMPTY, 'a');
    expect(state).toEqual({ sets: [], live: [[a()]] });
    expect(liveStatus(state, BEST_OF_3)).toMatchObject({
      phase: 'playing',
      setNumber: 1,
      score: { a: 1, b: 0 },
      canEndSet: true,
      canUndo: true,
    });
    state = play(state, 'b');
    expect(liveStatus(state, BEST_OF_3)).toMatchObject({ score: { a: 1, b: 1 }, canEndSet: false });
    // ending a level set does nothing
    expect(endSet(state)).toBe(state);
    expect(endSet(EMPTY)).toBe(EMPTY);
    expect(lastPoint(state)).toEqual(b());
  });

  it('ends a set when the scorer says so, whatever its length', () => {
    const set1 = endSet(play(EMPTY, 'aab'));
    expect(set1).toEqual({ sets: [{ a: 2, b: 1 }], live: [[a(), a(), b()]] });
    expect(liveStatus(set1, BEST_OF_3)).toMatchObject({
      phase: 'between',
      setNumber: 2,
      score: { a: 0, b: 0 },
      setsA: 1,
      setsB: 0,
      canScore: true,
      canEndSet: false,
      canUndo: true,
    });
    // the next point starts set 2
    const set2 = play(set1, 'b');
    expect(set2.live).toEqual([[a(), a(), b()], [b()]]);
    expect(liveStatus(set2, BEST_OF_3)).toMatchObject({ phase: 'playing', setNumber: 2 });
  });

  it('best of 3 is over after the second set won; no more points', () => {
    const over = endSet(play(endSet(play(EMPTY, 'a')), 'aa'));
    expect(liveStatus(over, BEST_OF_3)).toMatchObject({
      phase: 'over',
      setNumber: 2,
      setsA: 2,
      setsB: 0,
      canScore: false,
      canUndo: true,
    });
    expect(addPoint(over, 'b', BEST_OF_3)).toBe(over);
    // with "all sets" a 1:1 after two sets is over too (a draw)
    const draw = endSet(play(endSet(play(EMPTY, 'a', ALL_2)), 'b', ALL_2));
    expect(liveStatus(draw, ALL_2)).toMatchObject({ phase: 'over', setsA: 1, setsB: 1 });
  });

  it('the status of a typed-in result that is over names its last set', () => {
    const typed = liveStateOf({
      sets: [
        { a: 25, b: 20 },
        { a: 25, b: 22 },
      ],
    });
    expect(liveStatus(typed, BEST_OF_3)).toMatchObject({
      phase: 'over',
      setNumber: 2,
      canUndo: false,
    });
    expect(liveStatus(EMPTY, { setsPerMatch: 1, matchEnd: 'bestOf' }).setNumber).toBe(1);
  });

  describe('undo', () => {
    it('takes back the last rally; a set without rallies is no longer running', () => {
      const state = play(EMPTY, 'ab');
      expect(undoLast(state)).toEqual({ sets: [], live: [[a()]] });
      expect(undoLast(undoLast(state))).toEqual(EMPTY);
      expect(undoLast(EMPTY)).toBe(EMPTY);
    });

    it('between sets it re-opens the set that just ended, with its rallies', () => {
      const ended = endSet(play(EMPTY, 'aab'));
      expect(undoLast(ended)).toEqual({ sets: [], live: [[a(), a(), b()]] });
      // in the second set it first empties that set, then re-opens the first
      const second = play(ended, 'b');
      expect(undoLast(second)).toEqual(ended);
    });

    it('cannot re-open a set whose score was typed in', () => {
      const typed = liveStateOf({ sets: [{ a: 25, b: 20 }] });
      expect(liveStatus(typed, BEST_OF_3).canUndo).toBe(false);
      expect(undoLast(typed)).toBe(typed);
      // but a live set played after it can be undone back to the typed one
      const next = play(typed, 'a');
      expect(undoLast(next)).toEqual(typed);
    });
  });

  describe('tags', () => {
    it('tag the last rally with how it was won and, optionally, by whom', () => {
      const state = play(EMPTY, 'ab');
      const tagged = tagLastPoint(state, 'ace', 'p1');
      expect(tagged.live).toEqual([[a(), b({ kind: 'ace', playerId: 'p1' })]]);
      expect(lastPoint(tagged)).toEqual(b({ kind: 'ace', playerId: 'p1' }));
      // a kind alone drops the player; null removes the tag
      expect(tagLastPoint(tagged, 'block').live[0][1]).toEqual(b({ kind: 'block' }));
      expect(tagLastPoint(tagged, null).live[0][1]).toEqual(b());
      expect(tagLastPoint(EMPTY, 'ace')).toBe(EMPTY);
    });

    it('the last rally of a set that just ended can still be tagged; an earlier set’s not', () => {
      const ended = endSet(play(EMPTY, 'aab'));
      expect(tagLastPoint(ended, 'error').live[0][2]).toEqual(b({ kind: 'error' }));
      const typed = liveStateOf({ sets: [{ a: 25, b: 20 }] });
      expect(lastPoint(typed)).toBeNull();
      expect(tagLastPoint(typed, 'ace')).toBe(typed);
      // once the next set runs, only its rallies
      const second = play(ended, 'a');
      expect(tagLastPoint(second, 'ace').live[0]).toEqual(ended.live[0]);
    });

    it('name a player of the scoring side, or for an error of the other side', () => {
      expect(tagSide(a(), 'attack')).toBe('a');
      expect(tagSide(a(), 'ace')).toBe('a');
      expect(tagSide(b(), 'block')).toBe('b');
      expect(tagSide(a(), 'error')).toBe('b');
      expect(tagSide(b(), 'error')).toBe('a');
    });
  });

  it('knows whether a result has rallies, and what to store', () => {
    expect(hasLiveDetails(undefined)).toBe(false);
    expect(hasLiveDetails({})).toBe(false);
    expect(hasLiveDetails({ live: [[]] })).toBe(false);
    expect(hasLiveDetails({ live: [[], [a()]] })).toBe(true);
    expect(storedLive({ sets: [{ a: 25, b: 20 }], live: [[]] })).toEqual({
      sets: [{ a: 25, b: 20 }],
    });
    expect(storedLive(EMPTY)).toEqual({ sets: [] });
    const state = play(EMPTY, 'a');
    expect(storedLive(state)).toEqual({ sets: [], live: [[a()]] });
  });

  it('can be turned to the other team’s side', () => {
    const state = tagLastPoint(endSet(play(EMPTY, 'aab')), 'ace', 'p9');
    expect(flippedState(state)).toEqual({
      sets: [{ a: 1, b: 2 }],
      live: [[b(), b(), a({ kind: 'ace', playerId: 'p9' })]],
    });
  });
});

describe('what the rallies add up to', () => {
  const live: HostedPoint[][] = [
    [
      a({ kind: 'block' }),
      a({ kind: 'block', playerId: 'a6' }),
      a({ kind: 'ace', playerId: 'a6' }),
      b({ kind: 'attack', playerId: 'b1' }),
      a({ kind: 'error', playerId: 'b1' }), // an error of side b
      b({ kind: 'error' }), // an error of side a
      a(),
    ],
    [a({ kind: 'block' }), a({ kind: 'block', playerId: 'a6' })],
  ];

  it('counts points, kinds and players per side; an error counts for who made it', () => {
    const stats = liveStats(live);
    expect(stats.a.points).toBe(7);
    expect(stats.b.points).toBe(2);
    expect(stats.a.counts).toEqual({ attack: 0, ace: 1, block: 4, error: 1 });
    expect(stats.b.counts).toEqual({ attack: 1, ace: 0, block: 0, error: 1 });
    expect([...stats.a.players]).toEqual([['a6', { attack: 0, ace: 1, block: 2, error: 0 }]]);
    expect([...stats.b.players]).toEqual([['b1', { attack: 1, ace: 0, block: 0, error: 1 }]]);
    expect(hasTags(stats.a)).toBe(true);
    expect(hasTags(liveStats([[a(), b()]]).a)).toBe(false);
    expect(liveStats([])).toMatchObject({ a: { points: 0 }, b: { points: 0 } });
  });

  it('adds two sides up', () => {
    const one = liveStats(live).a;
    const sum = addStats(one, one);
    expect(sum.points).toBe(14);
    expect(sum.counts).toEqual({ attack: 0, ace: 2, block: 8, error: 2 });
    expect(sum.players.get('a6')).toEqual({ attack: 0, ace: 2, block: 4, error: 0 });
    // the parts are not changed
    expect(one.players.get('a6')).toEqual({ attack: 0, ace: 1, block: 2, error: 0 });
  });

  it('sums a team over its matches, whichever side it was on', () => {
    const results: HostedResult[] = [
      { id: 'r1', tournamentId: 'h', teamAId: 't1', teamBId: 't2', sets: [], live },
      { id: 'r2', tournamentId: 'h', teamAId: 't3', teamBId: 't1', sets: [], live },
      { id: 'r3', tournamentId: 'h', teamAId: 't2', teamBId: 't3', sets: [], live },
      { id: 'r4', tournamentId: 'h', teamAId: 't1', teamBId: 't3', sets: [{ a: 25, b: 1 }] },
    ];
    const total = teamLiveStats('t1', results);
    // side a of r1 and side b of r2
    expect(total.points).toBe(9);
    expect(total.counts).toEqual({ attack: 1, ace: 1, block: 4, error: 2 });
    expect(teamLiveStats('nobody', results).points).toBe(0);
  });
});

describe('players and live rallies in stored data', () => {
  const profiles = new Set(['pr1']);
  const cup: HostedTournament = {
    id: 'h1',
    profileId: 'pr1',
    name: 'Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
    plan: 'roundRobin',
    createdAt: '2026-11-28T10:00:00.000Z',
  };
  const data = (): HostedData => ({
    hostedTournaments: [cup],
    hostedTeams: [
      { id: 't1', tournamentId: 'h1', name: 'A', order: 0, playerLabel: 'name' },
      { id: 't2', tournamentId: 'h1', name: 'B', order: 1 },
    ],
    hostedPlayers: [
      { id: 'p1', teamId: 't1', number: 6, name: 'Kelly' },
      { id: 'p2', teamId: 't2', name: 'Mia' },
    ],
    hostedResults: [
      {
        id: 'r1',
        tournamentId: 'h1',
        teamAId: 't1',
        teamBId: 't2',
        sets: [{ a: 2, b: 1 }],
        live: [
          [a({ kind: 'ace', playerId: 'p1' }), a({ kind: 'error', playerId: 'p2' }), b()],
          [b({ kind: 'attack', playerId: 'p2' })],
        ],
      },
    ],
  });
  const ok = (change: (d: HostedData) => void): boolean => {
    const d = data();
    change(d);
    return isHostedConsistent(d, profiles);
  };
  const result = (d: HostedData) => d.hostedResults[0];

  it('accepts players, a label and rallies that fit', () => {
    expect(isHostedConsistent(data(), profiles)).toBe(true);
    // a finished set whose score was typed in has an empty list
    expect(ok((d) => (result(d).live = [[], [b()]]))).toBe(true);
    // rallies of the finished set only
    expect(ok((d) => (result(d).live = [[a(), a(), b()]]))).toBe(true);
  });

  it.each<[string, (d: HostedData) => void]>([
    ['a duplicate player id', (d) => d.hostedPlayers.push({ id: 'p1', teamId: 't2', number: 1 })],
    ['a player of an unknown team', (d) => (d.hostedPlayers[0].teamId = 'nope')],
    ['a player without number and name', (d) => (d.hostedPlayers[1] = { id: 'p2', teamId: 't2' })],
    ['a player with a blank name only', (d) => (d.hostedPlayers[1].name = '  ')],
    ['a number over 999', (d) => (d.hostedPlayers[0].number = 1000)],
    ['a negative number', (d) => (d.hostedPlayers[0].number = -1)],
    ['a number that is not whole', (d) => (d.hostedPlayers[0].number = 6.5)],
    ['fewer rally lists than sets', (d) => (result(d).live = [])],
    ['two rally lists more than sets', (d) => result(d).live?.push([a()])],
    ['an empty running set', (d) => (result(d).live = [[a(), a(), b()], []])],
    ['rallies that add up to another score', (d) => (result(d).live = [[a(), b(), b()]])],
    ['only empty rally lists', (d) => (result(d).live = [[]])],
    [
      'a running set after the match is decided',
      (d) => {
        result(d).sets = [
          { a: 2, b: 1 },
          { a: 1, b: 0 },
        ];
        result(d).live = [[a(), a(), b()], [a()], [b()]];
      },
    ],
    [
      'a named player without a kind',
      (d) => (result(d).live = [[a({ playerId: 'p1' }), a(), b()]]),
    ],
    [
      'a scorer of the other team',
      (d) => (result(d).live = [[a({ kind: 'ace', playerId: 'p2' }), a(), b()]]),
    ],
    [
      'an error by a player of the scoring team',
      (d) => (result(d).live = [[a({ kind: 'error', playerId: 'p1' }), a(), b()]]),
    ],
    [
      'an unknown player',
      (d) => (result(d).live = [[a({ kind: 'ace', playerId: 'x' }), a(), b()]]),
    ],
  ])('refuses %s', (_name, change) => {
    expect(ok(change)).toBe(false);
  });

  it('a round robin’s result may be a running first set, but not nothing at all', () => {
    expect(
      ok((d) => {
        result(d).sets = [];
        result(d).live = [[a(), b()]];
      }),
    ).toBe(true);
    expect(
      ok((d) => {
        result(d).sets = [];
        delete result(d).live;
      }),
    ).toBe(false);
  });

  it('players go with their team and their tournament', () => {
    expect(withoutHostedTeam(data(), 't1').hostedPlayers.map((p) => p.id)).toEqual(['p2']);
    expect(withoutHostedTournament(data(), 'h1').hostedPlayers).toEqual([]);
  });

  it('a removed player’s rallies keep how the point was won', () => {
    const d = data();
    d.hostedResults.push({ id: 'r2', tournamentId: 'h1', teamAId: 't1', teamBId: 't2', sets: [] });
    const without = withoutHostedPlayer(d, 'p1');
    expect(without.hostedPlayers.map((p) => p.id)).toEqual(['p2']);
    expect(without.hostedResults[0].live?.[0][0]).toEqual({ team: 'a', kind: 'ace' });
    expect(without.hostedResults[0].live?.[0][1]).toEqual(a({ kind: 'error', playerId: 'p2' }));
    // a result that doesn't name them is the same object
    expect(without.hostedResults[1]).toBe(d.hostedResults[1]);
    expect(withoutHostedPlayer(d, 'nobody').hostedResults[0]).toBe(d.hostedResults[0]);
  });

  it('merge matches players by id; the file’s player wins', () => {
    const file: HostedData = {
      ...emptyHosted(),
      hostedPlayers: [
        { id: 'p1', teamId: 't1', number: 7, name: 'Kelly' },
        { id: 'p3', teamId: 't2', number: 3 },
      ],
    };
    const merged = importHosted(data(), file, 'merge', profiles);
    expect(merged.ok && merged.hosted.hostedPlayers).toEqual([
      { id: 'p1', teamId: 't1', number: 7, name: 'Kelly' },
      { id: 'p2', teamId: 't2', name: 'Mia' },
      { id: 'p3', teamId: 't2', number: 3 },
    ]);
  });
});

describe('the plan knows a set that is being scored live', () => {
  const cup = { id: 'h1', plan: 'roundRobin', setsPerMatch: 3, matchEnd: 'bestOf' } as const;
  const teams = [
    { id: 't1', tournamentId: 'h1', name: 'A', order: 0 },
    { id: 't2', tournamentId: 'h1', name: 'B', order: 1 },
  ];
  const result = (extra: Partial<HostedResult>): HostedResult => ({
    id: 'r1',
    tournamentId: 'h1',
    teamAId: 't1',
    teamBId: 't2',
    sets: [],
    ...extra,
  });
  const only = (
    results: HostedResult[],
    source: typeof cup | { id: string; plan: 'manual'; setsPerMatch: 3; matchEnd: 'bestOf' } = cup,
  ) => tournamentPlan(source, teams, results).rounds[0].matches[0];

  it('a first set scored live makes the match running, with its score', () => {
    const match = only([result({ live: [[a(), a(), b()]] })]);
    expect(match.running).toEqual({ a: 2, b: 1 });
    expect(match.sets).toEqual([]);
    expect(match.outcome.state).toBe('running');
    expect(tournamentPlan(cup, teams, [result({ live: [[a()]] })]).played).toBe(0);
  });

  it('shows the running score from the side of the plan’s first team', () => {
    // stored the other way round (a file can be)
    const flipped = result({
      teamAId: 't2',
      teamBId: 't1',
      sets: [{ a: 1, b: 2 }],
      live: [
        [a(), b(), b()],
        [a(), a(), a()],
      ],
    });
    const match = only([flipped]);
    expect(match.sets).toEqual([{ a: 2, b: 1 }]);
    expect(match.running).toEqual({ a: 0, b: 3 });
  });

  it('has no running score between sets, for a typed result, or without one', () => {
    expect(only([result({ sets: [{ a: 2, b: 1 }], live: [[a(), a(), b()]] })]).running).toBeNull();
    expect(only([result({ sets: [{ a: 25, b: 20 }] })]).running).toBeNull();
    expect(only([]).running).toBeNull();
    expect(only([]).outcome.state).toBe('open');
  });

  it('an added match scored live is running too', () => {
    const manual = { ...cup, plan: 'manual' } as const;
    const match = only([result({ live: [[b()]] })], manual);
    expect(match.running).toEqual({ a: 0, b: 1 });
    expect(match.outcome.state).toBe('running');
    expect(only([result({})], manual).outcome.state).toBe('open');
  });
});
