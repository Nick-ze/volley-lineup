import { emptySetLineup } from './lineup';
import {
  combineStats,
  emptyStats,
  matchStats,
  playedSetNumbers,
  playerStatRows,
  seasonOverview,
  seasonStats,
  setStats,
  sideOutRate,
  type PlayerStats,
  type RotationStats,
} from './stats';
import type { Match, Player, PointEvent, PointKind, SetEvent, SetLineup, Side } from './types';

const player = (n: number): Player => ({
  id: `p${n}`,
  teamId: 't1',
  firstName: 'F',
  lastName: `L${n}`,
  number: n,
  positions: [n === 7 || n === 12 ? 'L' : 'OH'],
  active: true,
});
/** p1–p6 start, p7 is the libero (replaces p3 and p6 in the back row), p8–p12 on the bench. */
const players = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(player);

const W = (kind?: PointKind, playerId?: string): PointEvent => tagged('us', kind, playerId);
const L = (kind?: PointKind, playerId?: string): PointEvent => tagged('them', kind, playerId);
function tagged(winner: Side, kind?: PointKind, playerId?: string): PointEvent {
  return {
    type: 'point',
    winner,
    ...(kind === undefined ? {} : { kind }),
    ...(playerId === undefined ? {} : { playerId }),
  };
}
const sub = (outPlayerId: string, inPlayerId: string): SetEvent => ({
  type: 'sub',
  outPlayerId,
  inPlayerId,
});

const lineup = (over: Partial<SetLineup>): SetLineup => ({
  roles: {},
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
  weServeFirst: false,
  events: [],
  ...over,
});

const times = (n: number, event: PointEvent): PointEvent[] =>
  Array.from({ length: n }, () => event);

/*
 * Set 1 — the opponent serves first. Comments: rotation, who serves, what happens. Worked out by
 * hand from the rally rules (side-out = we rotate clockwise and serve), not by the code.
 */
const set1 = lineup({
  setNumber: 1,
  events: [
    L(), //                    e0  R1 them — lost
    W(), //                    e1  R1 them — side-out → R2 (p2 serves)
    W('ace', 'p2'), //         e2  R2 us p2 — break point
    L('ourError', 'p4'), //    e3  R2 us p2 — lost
    W('kill', 'p5'), //        e4  R2 them — side-out → R3 (p3 at 1)
    sub('p3', 'p8'), //        e5  server substitution before the serve
    W(), //                    e6  R3 us p8 — break point
    L(), //                    e7  R3 us p8 — lost
    W('block', 'p6'), //       e8  R3 them — side-out → R4 (p4 serves)
    W(), //                    e9  R4 us p4 — break point
    sub('p4', 'p9'), //        e10 server substitution during the turn
    W(), //                    e11 R4 us p9 — break point (new turn for p9)
    L(), //                    e12 R4 us p9 — lost
    W(), //                    e13 R4 them — side-out → R5 (p5 serves)
    L(), //                    e14 R5 us p5 — lost
    L('opponentKill'), //      e15 R5 them — lost
    W(), //                    e16 R5 them — side-out → R6 (p6 serves)
    sub('p8', 'p3'), //        e17 re-entry: p3 comes back for p8
    W(), //                    e18 R6 us p6 — break point
    L(), //                    e19 R6 us p6 — lost (libero now in for p6 at 1)
    W(), //                    e20 R6 them — side-out → R1 (libero in for p6 at 6)
    W(), //                    e21 R1 us p1 — break point
    L(), //                    e22 R1 us p1 — lost
  ],
});

/* Set 2 — we serve first; the libero is in for p6 from the first rally. */
const set2 = lineup({
  setNumber: 2,
  weServeFirst: true,
  events: [
    W('kill', 'p2'), //        e0  R1 us p1 — break point
    sub('p12', 'p11'), //      e1  invalid: p12 is not on court (skipped)
    L(), //                    e2  R1 us p1 — lost
    W('opponentError'), //     e3  R1 them — side-out → R2 (p2 serves)
    L(), //                    e4  R2 us p2 — lost
    L('ourError'), //          e5  R2 them — lost (error without a player)
    W(), //                    e6  R2 them — side-out → R3 (p3 serves)
    W('ace', 'p3'), //         e7  R3 us p3 — break point
  ],
});

/* Set 3 is stored but not played yet. */
const set3 = lineup({ setNumber: 3 });

const match1: Match = {
  id: 'm1',
  teamId: 't1',
  opponent: 'A',
  date: '2026-10-01',
  home: true,
  sets: [set3, set2, set1],
};

const rot = (
  rotation: RotationStats['rotation'],
  [won, lost, received, sideOuts, served, breakPoints]: number[],
): RotationStats => ({
  rotation,
  won: won as number,
  lost: lost as number,
  received: received as number,
  sideOuts: sideOuts as number,
  served: served as number,
  breakPoints: breakPoints as number,
});

/** [started, played, in, out, serveTurns, servePoints, kills, aces, blocks, errors] */
const line = (values: number[]): PlayerStats => {
  const [
    setsStarted,
    setsPlayed,
    subIn,
    subOut,
    serveTurns,
    servePoints,
    kills,
    aces,
    blocks,
    errors,
  ] = values as [number, number, number, number, number, number, number, number, number, number];
  return {
    setsStarted,
    setsPlayed,
    subIn,
    subOut,
    serveTurns,
    servePoints,
    kills,
    aces,
    blocks,
    errors,
  };
};

describe('setStats — rotations', () => {
  it('counts set 1 per rotation (won, lost, received, side-outs, served, break points)', () => {
    const s = setStats(set1, players);
    expect(s.points).toEqual({ us: 12, them: 8 });
    expect(s.rotations).toEqual([
      rot(1, [2, 2, 2, 1, 2, 1]),
      rot(2, [2, 1, 1, 1, 2, 1]),
      rot(3, [2, 1, 1, 1, 2, 1]),
      rot(4, [3, 1, 1, 1, 3, 2]),
      rot(5, [1, 2, 2, 1, 1, 0]),
      rot(6, [2, 1, 1, 1, 2, 1]),
    ]);
  });

  it('counts set 2 (we serve first) and leaves unplayed rotations at zero', () => {
    const s = setStats(set2, players);
    expect(s.points).toEqual({ us: 4, them: 3 });
    expect(s.rotations).toEqual([
      rot(1, [2, 1, 1, 1, 2, 1]),
      rot(2, [1, 2, 2, 1, 1, 0]),
      rot(3, [1, 0, 0, 0, 1, 1]),
      rot(4, [0, 0, 0, 0, 0, 0]),
      rot(5, [0, 0, 0, 0, 0, 0]),
      rot(6, [0, 0, 0, 0, 0, 0]),
    ]);
  });

  it('without a setter on court counts rotations from the start (fallback)', () => {
    // Every fixture player is an outside hitter (or libero): no role S on court, so set 1 and
    // set 2 above are already the fallback counting. A setter role for a bench player (p10, not
    // a starter, so it is ignored) changes nothing.
    expect(setStats({ ...set1, roles: { p10: 'S' } }, players).rotations).toEqual([
      rot(1, [2, 2, 2, 1, 2, 1]),
      rot(2, [2, 1, 1, 1, 2, 1]),
      rot(3, [2, 1, 1, 1, 2, 1]),
      rot(4, [3, 1, 1, 1, 3, 2]),
      rot(5, [1, 2, 2, 1, 1, 0]),
      rot(6, [2, 1, 1, 1, 2, 1]),
    ]);
  });

  it('side-out % is side-outs ÷ received, null when nothing was received', () => {
    expect(sideOutRate({ received: 3, sideOuts: 2 })).toBeCloseTo(0.6667, 4);
    expect(sideOutRate({ received: 4, sideOuts: 0 })).toBe(0);
    expect(sideOutRate({ received: 0, sideOuts: 0 })).toBeNull();
  });
});

/*
 * v4: rotations named after the setter's position. Set 1 again, with a setter. Worked out by
 * hand: the rows of set 1 counted from the start (R1…R6 above) move to the setter's position in
 * that rotation. Clockwise rule: each side-out moves every player one position on (2→1, 1→6,
 * 6→5, 5→4, 4→3, 3→2). A substitute inherits the setter role (p9 for p4 at e10).
 */
describe('setStats — rotations named after the setter', () => {
  it('setter starting at position 4: the first rallies count for R4', () => {
    // p4 (then p9) is at: start R1 → 4, R2 → 3, R3 → 2, R4 → 1, R5 → 6, R6 → 5.
    const s = setStats({ ...set1, roles: { p4: 'S' } }, players);
    expect(s.points).toEqual({ us: 12, them: 8 });
    expect(s.rotations).toEqual([
      rot(1, [3, 1, 1, 1, 3, 2]), // from-start R4 (e9, e11, e12, e13; setter p4 → p9 at 1)
      rot(2, [2, 1, 1, 1, 2, 1]), // from-start R3 (e6, e7, e8)
      rot(3, [2, 1, 1, 1, 2, 1]), // from-start R2 (e2, e3, e4)
      rot(4, [2, 2, 2, 1, 2, 1]), // from-start R1 (e0, e1, e21, e22)
      rot(5, [2, 1, 1, 1, 2, 1]), // from-start R6 (e18, e19, e20)
      rot(6, [1, 2, 2, 1, 1, 0]), // from-start R5 (e14, e15, e16)
    ]);
  });

  it('6-2 (setters p1 and p4): the back-row setter names the rotation', () => {
    // From start R1: p1 at 1 → R1. R2: p1 at 6 → R6. R3: p1 at 5 → R5. R4: p1 at 4 (front),
    // p4/p9 at 1 → R1. R5: p9 at 6 → R6. R6: p9 at 5 → R5. R2–R4 are never played.
    const s = setStats({ ...set1, roles: { p1: 'S', p4: 'S' } }, players);
    expect(s.rotations).toEqual([
      rot(1, [5, 3, 3, 2, 5, 3]), // [2,2,2,1,2,1] + [3,1,1,1,3,2]
      rot(2, [0, 0, 0, 0, 0, 0]),
      rot(3, [0, 0, 0, 0, 0, 0]),
      rot(4, [0, 0, 0, 0, 0, 0]),
      rot(5, [4, 2, 2, 2, 4, 2]), // [2,1,1,1,2,1] + [2,1,1,1,2,1]
      rot(6, [3, 3, 3, 2, 3, 1]), // [2,1,1,1,2,1] + [1,2,2,1,1,0]
    ]);
  });

  it('a setter at position 1 in set 2 (we serve first): R1, then R6, then R5', () => {
    const s = setStats({ ...set2, roles: { p1: 'S' } }, players);
    expect(s.rotations).toEqual([
      rot(1, [2, 1, 1, 1, 2, 1]), // e0, e2, e3
      rot(2, [0, 0, 0, 0, 0, 0]),
      rot(3, [0, 0, 0, 0, 0, 0]),
      rot(4, [0, 0, 0, 0, 0, 0]),
      rot(5, [1, 0, 0, 0, 1, 1]), // e7 (p1 at 5)
      rot(6, [1, 2, 2, 1, 1, 0]), // e4, e5, e6 (p1 at 6)
    ]);
  });

  it('a setter by roster position (primary S, no override) counts the same', () => {
    const withSetter = players.map((p) =>
      p.id === 'p4' ? { ...p, positions: ['S' as const] } : p,
    );
    expect(setStats(set1, withSetter).rotations).toEqual(
      setStats({ ...set1, roles: { p4: 'S' } }, players).rotations,
    );
  });

  it('roles change only the rotation rows, not the player numbers', () => {
    expect(setStats({ ...set1, roles: { p4: 'S' } }, players).players).toEqual(
      setStats(set1, players).players,
    );
  });
});

describe('setStats — libero switched off (v4)', () => {
  it('never counts the libero as started or played, and rotations stay the same', () => {
    const on = setStats(set1, players);
    const off = setStats({ ...set1, liberoActive: false }, players);
    expect(on.players.p7).toEqual(line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]));
    expect(off.players.p7).toBeUndefined();
    const { p7: _libero, ...others } = on.players;
    expect(off.players).toEqual(others);
    expect(off.rotations).toEqual(on.rotations);
    // Also in a set where the libero would be in from the first rally (set 2).
    expect(setStats({ ...set2, liberoActive: false }, players).players.p7).toBeUndefined();
  });
});

describe('setStats — players', () => {
  it('counts set 1: starts, subs incl. re-entry, serve turns with server subs, tags, libero', () => {
    expect(setStats(set1, players).players).toEqual({
      p1: line([1, 1, 0, 0, 1, 1, 0, 0, 0, 0]),
      p2: line([1, 1, 0, 0, 1, 1, 0, 1, 0, 0]),
      p3: line([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
      p4: line([1, 1, 0, 1, 1, 1, 0, 0, 0, 1]),
      p5: line([1, 1, 0, 0, 1, 0, 1, 0, 0, 0]),
      p6: line([1, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
      p7: line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
      p8: line([0, 1, 1, 1, 1, 1, 0, 0, 0, 0]),
      p9: line([0, 1, 1, 0, 1, 1, 0, 0, 0, 0]),
    });
  });

  it('counts set 2: invalid subs and player-less tags count for nobody', () => {
    expect(setStats(set2, players).players).toEqual({
      p1: line([1, 1, 0, 0, 1, 1, 0, 0, 0, 0]),
      p2: line([1, 1, 0, 0, 1, 0, 1, 0, 0, 0]),
      p3: line([1, 1, 0, 0, 1, 1, 0, 1, 0, 0]),
      p4: line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
      p5: line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
      p6: line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
      p7: line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
    });
  });

  it('a set without rallies counts nothing, not even its substitutions', () => {
    expect(setStats(lineup({ events: [sub('p1', 'p8')] }), players)).toEqual(emptyStats());
  });

  it('counts subs after the last rally of a played set', () => {
    const s = setStats(lineup({ events: [W(), sub('p1', 'p8')] }), players);
    expect(s.players.p1?.subOut).toBe(1);
    expect(s.players.p8).toEqual(line([0, 0, 1, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('a server subbed out and back within one serving run has two turns', () => {
    const run = [W(), sub('p1', 'p8'), W(), sub('p8', 'p1'), W()];
    const s = setStats(lineup({ weServeFirst: true, liberoId: null, events: run }), players);
    expect(s.players.p1?.serveTurns).toBe(2);
    expect(s.players.p1?.servePoints).toBe(2);
    expect(s.players.p8?.serveTurns).toBe(1);
    // Out and straight back with no rally between: still one turn.
    const back = [W(), sub('p1', 'p8'), sub('p8', 'p1'), W()];
    const t = setStats(lineup({ weServeFirst: true, liberoId: null, events: back }), players);
    expect(t.players.p1?.serveTurns).toBe(1);
  });

  it('a libero whose swap never applied has not started or played', () => {
    const s = setStats(lineup({ liberoId: 'p12', liberoReplaces: [], events: [W()] }), players);
    expect(s.players.p12).toBeUndefined();
    expect(Object.keys(s.players).sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('an empty position has no server, no start and no serve turn', () => {
    const set = lineup({
      weServeFirst: true,
      liberoId: null,
      slots: { 1: null, 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
      events: [W(), W()],
    });
    const s = setStats(set, players);
    expect(s.rotations[0]).toEqual(rot(1, [2, 0, 0, 0, 2, 2]));
    expect(s.players.p1).toBeUndefined();
    expect(s.players.p2).toEqual(line([1, 1, 0, 0, 0, 0, 0, 0, 0, 0]));
  });
});

describe('matchStats', () => {
  it('sums the played sets of the match', () => {
    const s = matchStats(match1, players);
    expect(s.points).toEqual({ us: 16, them: 11 });
    expect(s.rotations).toEqual([
      rot(1, [4, 3, 3, 2, 4, 2]),
      rot(2, [3, 3, 3, 2, 3, 1]),
      rot(3, [3, 1, 1, 1, 3, 2]),
      rot(4, [3, 1, 1, 1, 3, 2]),
      rot(5, [1, 2, 2, 1, 1, 0]),
      rot(6, [2, 1, 1, 1, 2, 1]),
    ]);
    expect(s.players).toEqual({
      p1: line([2, 2, 0, 0, 2, 2, 0, 0, 0, 0]),
      p2: line([2, 2, 0, 0, 2, 1, 1, 1, 0, 0]),
      p3: line([2, 2, 1, 1, 1, 1, 0, 1, 0, 0]),
      p4: line([2, 2, 0, 1, 1, 1, 0, 0, 0, 1]),
      p5: line([2, 2, 0, 0, 1, 0, 1, 0, 0, 0]),
      p6: line([2, 2, 0, 0, 1, 1, 0, 0, 1, 0]),
      p7: line([2, 2, 0, 0, 0, 0, 0, 0, 0, 0]),
      p8: line([0, 1, 1, 1, 1, 1, 0, 0, 0, 0]),
      p9: line([0, 1, 1, 0, 1, 1, 0, 0, 0, 0]),
    });
  });

  it('filters by set', () => {
    expect(matchStats(match1, players, 2)).toEqual(setStats(set2, players));
    expect(matchStats(match1, players, 2).points).toEqual({ us: 4, them: 3 });
    expect(matchStats(match1, players, 3)).toEqual(emptyStats());
  });

  it('offers the played sets as filter options, in order', () => {
    expect(playedSetNumbers(match1)).toEqual([1, 2]);
    expect(playedSetNumbers({ sets: [] })).toEqual([]);
  });
});

/* Season: match1 (in progress), a 3:0 win, a 0:3 loss and a match not started yet. */
const straight = (setNumber: SetLineup['setNumber'], winner: Side): SetLineup =>
  lineup({
    setNumber,
    liberoId: null,
    liberoReplaces: [],
    weServeFirst: winner === 'us',
    events: times(25, winner === 'us' ? W() : L()),
  });
const won: Match = {
  ...match1,
  id: 'm2',
  // Set 4 was stored after the match was decided (pre-v3 data): it is ignored.
  sets: [
    straight(1, 'us'),
    straight(2, 'us'),
    straight(3, 'us'),
    lineup({ setNumber: 4, events: [W()] }),
  ],
};
const lost: Match = { ...match1, id: 'm3', sets: [1, 2, 3].map((n) => straight(n as 1, 'them')) };
const notStarted: Match = { ...match1, id: 'm4', sets: [emptySetLineup(1)] };
const season = [match1, won, lost, notStarted];

describe('season', () => {
  it('overview: matches won / lost / in progress, sets and points', () => {
    expect(seasonOverview(season)).toEqual({
      played: 3,
      won: 1,
      lost: 1,
      inProgress: 1,
      sets: { us: 3, them: 3 },
      points: { us: 91, them: 86 },
    });
    expect(seasonOverview([notStarted]).played).toBe(0);
  });

  it('sums all matches, ignoring sets after the deciding set', () => {
    const s = seasonStats(season, players);
    expect(s.points).toEqual({ us: 91, them: 86 });
    expect(s.rotations[0]).toEqual(rot(1, [79, 78, 78, 2, 79, 77]));
    expect(s.players.p1).toEqual(line([8, 8, 0, 0, 5, 77, 0, 0, 0, 0]));
    expect(s.players.p7).toEqual(line([2, 2, 0, 0, 0, 0, 0, 0, 0, 0]));
  });

  it('combining nothing gives empty stats', () => {
    expect(combineStats([])).toEqual(emptyStats());
  });
});

describe('playerStatRows', () => {
  it('lists the players with stats in jersey order', () => {
    const rows = playerStatRows(matchStats(match1, players, 2), players);
    expect(rows.map((r) => r.player.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(rows[1]?.stats.kills).toBe(1);
  });
});
