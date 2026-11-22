import { emptySetLineup } from './lineup';
import {
  attackErrorRate,
  compareByPerformance,
  combinePerformance,
  emptyPlayerPerformance,
  ERROR_CATEGORIES,
  errorBreakdown,
  errorRate,
  errorsPerAction,
  matchPerformance,
  netPoints,
  performanceRows,
  playerSeason,
  plusMinus,
  rating,
  serveErrorRate,
  setPerformance,
  type PlayerPerformance,
} from './performance';
import type { ErrorType, Match, Player, PointEvent, PointKind, SetLineup, Side } from './types';

const player = (n: number): Player => ({
  id: `p${n}`,
  teamId: 't1',
  firstName: 'F',
  lastName: `L${n}`,
  number: n,
  positions: [n === 7 ? 'L' : n === 3 || n === 6 ? 'MB' : 'OH'],
  active: true,
});
const players = [1, 2, 3, 4, 5, 6, 7, 8].map(player);

function point(winner: Side, kind?: PointKind, playerId?: string, errorType?: ErrorType) {
  const e: PointEvent = { type: 'point', winner };
  if (kind !== undefined) e.kind = kind;
  if (playerId !== undefined) e.playerId = playerId;
  if (errorType !== undefined) e.errorType = errorType;
  return e;
}
const W = (kind?: PointKind, id?: string) => point('us', kind, id);
const L = (kind?: PointKind, id?: string, type?: ErrorType) => point('them', kind, id, type);

const lineup = (over: Partial<SetLineup>): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
  weServeFirst: true,
  events: [],
  ...over,
});

/*
 * Set 1, worked out by hand. We serve first. The libero p7 replaces p3 / p6 in the back row
 * (p3 first), never at 1 on our serve. Court = who stood on court during the rally.
 *
 * e0 W ace p1          we serve (p1)  court p1 p2 p3 p4 p5 p7 (p7 for p6 at 6)
 * e1 L error p2 attack we serve (p1)  same                         → they serve
 * e2 W kill p4         they serve     same                         → side-out: 1 p2 2 p3 3 p4 4 p5 5 p6 6 p1
 * e3 sub p5 → p8       (p8 at 4)
 * e4 L error p2 serve  we serve (p2)  court p2 p3 p4 p8 p7 p1 (p7 for p6 at 5) → they serve
 * e5 L error p7 recep. they serve     same
 * e6 W                 they serve     same                         → side-out: 1 p3 2 p4 3 p8 4 p6 5 p1 6 p2
 * e7 W block p4        we serve (p3)  court p3 p4 p8 p6 p1 p2 (p3 serves, p6 front: no swap)
 * e8 L                 we serve (p3)  same                         → they serve
 * e9 L error (none) net they serve    court p7 p4 p8 p6 p1 p2 (p7 for p3 at 1)
 *
 * 9 rallies: won e0 e2 e6 e7 (4), lost e1 e4 e5 e8 e9 (5).
 */
const set1 = lineup({
  events: [
    W('ace', 'p1'),
    L('ourError', 'p2', 'attack'),
    W('kill', 'p4'),
    { type: 'sub', outPlayerId: 'p5', inPlayerId: 'p8' },
    L('ourError', 'p2', 'serve'),
    L('ourError', 'p7', 'reception'),
    W(),
    W('block', 'p4'),
    L(),
    L('ourError', undefined, 'netFault'),
  ],
});

/* Set 2: the libero is switched off; they serve. e0 L error p6 block, e1 W (side-out). */
const set2 = lineup({
  setNumber: 2,
  liberoActive: false,
  weServeFirst: false,
  events: [L('ourError', 'p6', 'block'), W()],
});

const match = (id: string, sets: SetLineup[]): Match => ({
  id,
  teamId: 't1',
  opponent: id,
  date: '2026-11-21',
  home: true,
  sets,
});

const errors = (over: Partial<Record<string, number>>) => ({
  serve: 0,
  reception: 0,
  attack: 0,
  block: 0,
  set: 0,
  netFault: 0,
  other: 0,
  unspecified: 0,
  ...over,
});

describe('setPerformance (scripted set with a sub and libero swaps)', () => {
  const perf = setPerformance(set1, players);

  it('counts the rallies of the set', () => {
    expect(perf.rallies).toBe(9);
    expect(Object.keys(perf.players).sort()).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
    ]);
  });

  it('rallies on court, won / lost — libero included, the replaced middles not', () => {
    const court = Object.fromEntries(
      Object.entries(perf.players).map(([id, p]) => [id, [p.rallies, p.won, p.lost]]),
    );
    expect(court).toEqual({
      p1: [9, 4, 5],
      p2: [9, 4, 5],
      p3: [8, 4, 4],
      p4: [9, 4, 5],
      p5: [3, 2, 1],
      p6: [3, 1, 2],
      p7: [7, 3, 4],
      p8: [6, 2, 4],
    });
  });

  it('full lines for the server with an error, the libero and the substitute', () => {
    expect(perf.players.p2).toEqual({
      setsStarted: 1,
      setsPlayed: 1,
      subIn: 0,
      subOut: 0,
      serveTurns: 1,
      servePoints: 0,
      kills: 0,
      aces: 0,
      blocks: 0,
      errors: 2,
      rallies: 9,
      won: 4,
      lost: 5,
      serves: 1,
      errorsByType: errors({ serve: 1, attack: 1 }),
    });
    expect(perf.players.p7).toMatchObject({
      setsStarted: 1,
      setsPlayed: 1,
      rallies: 7,
      serves: 0,
      errors: 1,
      errorsByType: errors({ reception: 1 }),
    });
    expect(perf.players.p8).toMatchObject({ setsStarted: 0, setsPlayed: 1, subIn: 1, rallies: 6 });
    expect(perf.players.p5).toMatchObject({ setsStarted: 1, subOut: 1, rallies: 3 });
  });

  it('serves and points on serve', () => {
    expect([perf.players.p1.serves, perf.players.p1.servePoints]).toEqual([2, 1]);
    expect([perf.players.p3.serves, perf.players.p3.servePoints]).toEqual([2, 1]);
    expect(perf.players.p4.serves).toBe(0);
  });

  it('an error without a player counts for nobody', () => {
    const total = Object.values(perf.players).reduce((n, p) => n + p.errorsByType.netFault, 0);
    expect(total).toBe(0);
  });

  it('derived numbers', () => {
    const { p1, p2, p3, p4, p5, p6, p7 } = perf.players as Record<string, PlayerPerformance>;
    expect([plusMinus(p1), plusMinus(p3), plusMinus(p5), plusMinus(p8())]).toEqual([-1, 0, 1, -2]);
    expect([netPoints(p1), netPoints(p2), netPoints(p4), netPoints(p7)]).toEqual([1, -2, 2, -1]);
    expect([rating(p1), rating(p2), rating(p3), rating(p5), rating(p6)]).toEqual([
      'positive',
      'negative',
      'even',
      'positive',
      'negative',
    ]);
    expect(errorRate(p2)).toBeCloseTo(2 / 9);
    expect(errorRate(p4)).toBe(0);
    expect([errorsPerAction(p2), errorsPerAction(p4), errorsPerAction(p3)]).toEqual([1, 0, null]);
    expect([serveErrorRate(p2), serveErrorRate(p1), serveErrorRate(p4)]).toEqual([1, 0, null]);
    expect([attackErrorRate(p2), attackErrorRate(p4), attackErrorRate(p1)]).toEqual([1, 0, null]);
    expect(errorBreakdown(p2)).toEqual([
      { category: 'serve', count: 1 },
      { category: 'attack', count: 1 },
    ]);
    expect(errorBreakdown(p1)).toEqual([]);
    function p8() {
      return perf.players.p8 as PlayerPerformance;
    }
  });

  it('rows: best first, worst last (v6.2)', () => {
    // ▲ p4 (net +2), p1 (net +1), p5 (no tags, +1) · ● p3 · ▼ p6 (net 0, −1), p8 (net 0, −2),
    // p7 (net −1), p2 (net −2).
    expect(performanceRows(perf, [...players].reverse()).map((r) => r.player.id)).toEqual([
      'p4',
      'p1',
      'p5',
      'p3',
      'p6',
      'p8',
      'p7',
      'p2',
    ]);
    expect(performanceRows(perf, players.slice(0, 2)).map((r) => r.player.id)).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('ranks by rating, then net points, plus/minus, rallies; nobody without rallies on top', () => {
    const line = (over: Partial<PlayerPerformance>) => ({ ...emptyPlayerPerformance(), ...over });
    const strong = line({ rallies: 10, won: 6, lost: 4, kills: 3 });
    const sameNetBetterPm = line({ rallies: 10, won: 7, lost: 3, kills: 3 });
    const sameButMoreRallies = line({ rallies: 12, won: 8, lost: 4, kills: 3 });
    const bench = line({ subIn: 1 });
    expect(compareByPerformance(sameNetBetterPm, strong)).toBeLessThan(0);
    expect(compareByPerformance(sameButMoreRallies, sameNetBetterPm)).toBeLessThan(0);
    expect(compareByPerformance(strong, bench)).toBeLessThan(0);
    expect(compareByPerformance(strong, { ...strong })).toBe(0);
    expect(compareByPerformance(bench, strong)).toBeGreaterThan(0);
    expect(compareByPerformance(bench, { ...bench })).toBe(0);
    // Equal lines: by jersey number.
    const tied = { rallies: 0, players: { p2: strong, p1: { ...strong } } };
    expect(performanceRows(tied, players).map((r) => r.player.id)).toEqual(['p1', 'p2']);
  });

  it('an empty court spot counts for nobody', () => {
    const short = lineup({
      slots: { ...set1.slots, 5: null },
      liberoId: null,
      events: [W()],
    });
    expect(setPerformance(short, players).players.p5).toBeUndefined();
    expect(setPerformance(short, players).players.p1?.rallies).toBe(1);
  });

  it('a set without rallies has nothing', () => {
    expect(setPerformance(lineup({ events: [] }), players)).toEqual({ rallies: 0, players: {} });
  });
});

describe('matches and season', () => {
  const m1 = match('m1', [set1, set2]);
  const m2 = match('m2', [emptySetLineup(1)]);

  it('a match adds up its sets; one set can be picked', () => {
    const all = matchPerformance(m1, players);
    expect(all.rallies).toBe(11);
    expect(all.players.p1).toMatchObject({
      setsStarted: 2,
      setsPlayed: 2,
      rallies: 11,
      won: 5,
      lost: 6,
      serves: 2,
    });
    expect(all.players.p6).toMatchObject({
      rallies: 5,
      won: 2,
      lost: 3,
      errors: 1,
      errorsByType: errors({ block: 1 }),
    });
    expect(all.players.p7).toMatchObject({ setsStarted: 1, setsPlayed: 1, rallies: 7 });
    const second = matchPerformance(m1, players, 2);
    expect(second.rallies).toBe(2);
    expect(second.players.p7).toBeUndefined();
    expect(second.players.p3).toMatchObject({ rallies: 2, won: 1, lost: 1 });
  });

  it("a player's season: total and one line per match they appear in", () => {
    const season = playerSeason([m1, m2], players, 'p6');
    expect(season.rallies).toBe(11);
    expect(season.matches.map((l) => [l.match.id, l.rallies, l.performance.rallies])).toEqual([
      ['m1', 11, 5],
    ]);
    expect(season.total).toEqual(season.matches[0]?.performance);
    expect(playerSeason([m1, m2], players, 'nobody')).toEqual({
      rallies: 0,
      total: emptyPlayerPerformance(),
      matches: [],
    });
  });

  it('combining nothing gives nothing; categories in display order', () => {
    expect(combinePerformance([])).toEqual({ rallies: 0, players: {} });
    expect(ERROR_CATEGORIES).toEqual([
      'serve',
      'reception',
      'attack',
      'block',
      'set',
      'netFault',
      'other',
      'unspecified',
    ]);
  });

  it('rating is null without rallies on court; an untyped error is unspecified', () => {
    expect(rating(emptyPlayerPerformance())).toBeNull();
    const s = lineup({ events: [L('ourError', 'p1')] });
    expect(setPerformance(s, players).players.p1?.errorsByType.unspecified).toBe(1);
  });
});
