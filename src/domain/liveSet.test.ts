import {
  addPoint,
  addSub,
  liveCourtView,
  MAX_SUBS_PER_SET,
  previewSub,
  replaySet,
  replaySteps,
  setPointOf,
  setWinnerOf,
  targetPoints,
  undo,
} from './liveSet';
import type { Player, SetEvent, SetLineup, Side } from './types';
import { emptySetLineup } from './lineup';

const player = (n: number, positions: Player['positions'] = ['OH']): Player => ({
  id: `p${n}`,
  teamId: 't1',
  firstName: 'F',
  lastName: `L${n}`,
  number: n,
  positions,
  active: true,
});

/** p1–p6 start at positions 1–6, p7 is the libero, p8–p13 are on the bench. */
const players: Player[] = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]
  .map((n) => player(n))
  .concat(player(7, ['L']));

const baseSet = (over: Partial<SetLineup> = {}): SetLineup => ({
  roles: {},
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: true,
  liberoReplaces: [],
  events: [],
  ...over,
});

const withEvents = (events: SetEvent[], over: Partial<SetLineup> = {}) =>
  baseSet({ ...over, events });

const pt = (winner: Side): SetEvent => ({ type: 'point', winner });
const sub = (outPlayerId: string, inPlayerId: string): SetEvent => ({
  type: 'sub',
  outPlayerId,
  inPlayerId,
});

/** Player numbers on court, positions 1→6, as a string like "2 3 4 5 6 1". */
const lineupOf = (s: SetLineup) => {
  const { slots } = replaySet(s, players);
  return [1, 2, 3, 4, 5, 6].map((p) => (slots[p as 1] ?? '-').slice(1)).join(' ');
};

/** The court in each rotation when no substitution is active (written out, not computed). */
const ROT: Record<number, string> = {
  1: '1 2 3 4 5 6',
  2: '2 3 4 5 6 1',
  3: '3 4 5 6 1 2',
  4: '4 5 6 1 2 3',
  5: '5 6 1 2 3 4',
  6: '6 1 2 3 4 5',
};

type PointRow = [Side, number, number, Side, number, Side | null];
type SubRow = ['sub', string, string, string];
type Row = PointRow | SubRow;

describe('replaySet — a full set rally by rally (opponent serves first)', () => {
  // [winner, us, them, serving side afterwards, rotation, set point] or ['sub', out, in, court].
  const rows: Row[] = [
    ['us', 1, 0, 'us', 2, null], // side-out: rotate, #2 serves
    ['us', 2, 0, 'us', 2, null], // won on our serve: no rotation
    ['them', 2, 1, 'them', 2, null], // lost: serve to them, no rotation
    ['them', 2, 2, 'them', 2, null],
    ['us', 3, 2, 'us', 3, null],
    ['them', 3, 3, 'them', 3, null],
    ['us', 4, 3, 'us', 4, null],
    ['us', 5, 3, 'us', 4, null],
    ['us', 6, 3, 'us', 4, null],
    ['sub', 'p5', 'p8', '4 8 6 1 2 3'], // #8 takes #5's spot at position 2
    ['them', 6, 4, 'them', 4, null],
    ['us', 7, 4, 'us', 5, null], // side-out moves #8 to serve
    ['sub', 'p8', 'p5', '5 6 1 2 3 4'], // #5 comes back for #8
    ['them', 7, 5, 'them', 5, null],
    ['us', 8, 5, 'us', 6, null],
    ['them', 8, 6, 'them', 6, null],
    ['us', 9, 6, 'us', 1, null], // rotation 6 → 1 wraps
    ['them', 9, 7, 'them', 1, null],
    ['us', 10, 7, 'us', 2, null],
    ['us', 11, 7, 'us', 2, null],
    ['them', 11, 8, 'them', 2, null],
    ['them', 11, 9, 'them', 2, null],
    ['us', 12, 9, 'us', 3, null],
    ['us', 13, 9, 'us', 3, null],
    ['us', 14, 9, 'us', 3, null],
    ['them', 14, 10, 'them', 3, null],
    ['us', 15, 10, 'us', 4, null],
    ['them', 15, 11, 'them', 4, null],
    ['them', 15, 12, 'them', 4, null],
    ['them', 15, 13, 'them', 4, null],
    ['us', 16, 13, 'us', 5, null],
    ['them', 16, 14, 'them', 5, null],
    ['us', 17, 14, 'us', 6, null],
    ['us', 18, 14, 'us', 6, null],
    ['them', 18, 15, 'them', 6, null],
    ['us', 19, 15, 'us', 1, null],
    ['them', 19, 16, 'them', 1, null],
    ['them', 19, 17, 'them', 1, null],
    ['us', 20, 17, 'us', 2, null],
    ['us', 21, 17, 'us', 2, null],
    ['them', 21, 18, 'them', 2, null],
    ['us', 22, 18, 'us', 3, null],
    ['them', 22, 19, 'them', 3, null],
    ['them', 22, 20, 'them', 3, null],
    ['us', 23, 20, 'us', 4, null],
    ['them', 23, 21, 'them', 4, null],
    ['them', 23, 22, 'them', 4, null],
    ['us', 24, 22, 'us', 5, 'us'], // set point us
    ['them', 24, 23, 'them', 5, 'us'], // still set point us
    ['them', 24, 24, 'them', 5, null], // deuce
    ['them', 24, 25, 'them', 5, 'them'], // set point them
    ['us', 25, 25, 'us', 6, null],
    ['us', 26, 25, 'us', 6, 'us'],
  ];
  /** Court for the two rows while #8 is on court (rows 10–12). */
  const SUB_COURT: Record<number, string> = { 10: '4 8 6 1 2 3', 11: '8 6 1 2 3 4' };

  it('has the right score, rotation, server, court and set point after every rally', () => {
    let set = baseSet({ weServeFirst: false });
    expect(replaySet(set, players)).toMatchObject({
      score: { us: 0, them: 0 },
      rotation: 1,
      servingSide: 'them',
      serverId: null,
      subsUsed: 0,
      setPoint: null,
      setWinner: null,
      warnings: [],
    });
    let subs = 0;
    rows.forEach((row, i) => {
      if (row[0] === 'sub') {
        set = addSub(set, row[1], row[2]);
        subs += 1;
        expect(lineupOf(set)).toBe(row[3]);
        expect(replaySet(set, players).subsUsed).toBe(subs);
        return;
      }
      const [winner, us, them, serving, rotation, setPoint] = row;
      set = addPoint(set, winner);
      const state = replaySet(set, players);
      const court = SUB_COURT[i] ?? ROT[rotation];
      expect({ i, score: state.score, serving: state.servingSide, rot: state.rotation }).toEqual({
        i,
        score: { us, them },
        serving,
        rot: rotation,
      });
      expect(lineupOf(set)).toBe(court);
      expect(state.serverId).toBe(serving === 'us' ? `p${court.split(' ')[0]}` : null);
      expect(state.setPoint).toBe(setPoint);
      expect(state.setWinner).toBeNull();
    });

    // 27:25 — we win the set by two.
    set = addPoint(set, 'us');
    const end = replaySet(set, players);
    expect(end.score).toEqual({ us: 27, them: 25 });
    expect(end.setWinner).toBe('us');
    expect(end.setPoint).toBeNull();
    expect(end.subsUsed).toBe(2);
    expect(end.warnings).toEqual([]);
    expect(end.serverId).toBe('p6');
  });

  it('undo steps back through the same states', () => {
    let set = baseSet({ weServeFirst: false });
    set = addPoint(addPoint(addPoint(set, 'us'), 'them'), 'us');
    expect(replaySet(set, players)).toMatchObject({ score: { us: 2, them: 1 }, rotation: 3 });
    set = undo(set);
    expect(replaySet(set, players)).toMatchObject({
      score: { us: 1, them: 1 },
      rotation: 2,
      servingSide: 'them',
    });
    set = undo(undo(set));
    expect(set.events).toEqual([]);
    expect(replaySet(set, players)).toMatchObject({ rotation: 1, servingSide: 'them' });
  });
});

describe('replaySet — serve and rotation rules', () => {
  it('we serve first: #1 serves, winning keeps the rotation, losing gives the serve away', () => {
    expect(replaySet(baseSet(), players)).toMatchObject({ servingSide: 'us', serverId: 'p1' });
    const won = withEvents([pt('us'), pt('us')]);
    expect(replaySet(won, players)).toMatchObject({ rotation: 1, serverId: 'p1' });
    expect(lineupOf(won)).toBe('1 2 3 4 5 6');
    const lost = withEvents([pt('them')]);
    expect(replaySet(lost, players)).toMatchObject({
      score: { us: 0, them: 1 },
      rotation: 1,
      servingSide: 'them',
      serverId: null,
    });
    const sideOut = withEvents([pt('them'), pt('us')]);
    expect(replaySet(sideOut, players)).toMatchObject({ rotation: 2, serverId: 'p2' });
    expect(lineupOf(sideOut)).toBe('2 3 4 5 6 1');
  });

  it('six side-outs bring the starting rotation back', () => {
    const events = Array.from({ length: 6 }, () => [pt('them'), pt('us')]).flat();
    const state = replaySet(withEvents(events), players);
    expect(state.rotation).toBe(1);
    expect(state.score).toEqual({ us: 6, them: 6 });
    expect(lineupOf(withEvents(events))).toBe('1 2 3 4 5 6');
  });

  it('does not change the stored starting lineup', () => {
    const set = withEvents([pt('them'), pt('us'), sub('p3', 'p8')]);
    replaySet(set, players);
    expect(set.slots).toEqual({ 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' });
  });

  it('an empty court slot has no server', () => {
    const set = baseSet({ slots: { 1: null, 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' } });
    expect(replaySet(set, players).serverId).toBeNull();
  });
});

describe('set point and set end', () => {
  it('targets 25, or 15 in set 5', () => {
    expect(targetPoints(1)).toBe(25);
    expect(targetPoints(4)).toBe(25);
    expect(targetPoints(5)).toBe(15);
  });

  it('set point: one point from the target and ahead, also in deuce', () => {
    expect(setPointOf({ us: 23, them: 20 }, 25)).toBeNull();
    expect(setPointOf({ us: 24, them: 23 }, 25)).toBe('us');
    expect(setPointOf({ us: 10, them: 24 }, 25)).toBe('them');
    expect(setPointOf({ us: 24, them: 24 }, 25)).toBeNull();
    expect(setPointOf({ us: 26, them: 25 }, 25)).toBe('us');
    expect(setPointOf({ us: 30, them: 31 }, 25)).toBe('them');
    expect(setPointOf({ us: 25, them: 20 }, 25)).toBeNull(); // already won
    expect(setPointOf({ us: 14, them: 12 }, 15)).toBe('us');
  });

  it('set winner: target reached with a two-point lead', () => {
    expect(setWinnerOf({ us: 25, them: 23 }, 25)).toBe('us');
    expect(setWinnerOf({ us: 25, them: 24 }, 25)).toBeNull();
    expect(setWinnerOf({ us: 26, them: 28 }, 25)).toBe('them');
    expect(setWinnerOf({ us: 15, them: 13 }, 15)).toBe('us');
    expect(setWinnerOf({ us: 15, them: 14 }, 15)).toBeNull();
  });

  it('set 5 uses 15 points in replay', () => {
    const events = [...Array(14).fill(pt('us')), ...Array(13).fill(pt('them'))] as SetEvent[];
    const set = withEvents(events, { setNumber: 5 });
    expect(replaySet(set, players)).toMatchObject({ score: { us: 14, them: 13 }, setPoint: 'us' });
    expect(replaySet(addPoint(set, 'us'), players).setWinner).toBe('us');
  });
});

describe('substitutions', () => {
  it('a substitute takes the position of the player going out', () => {
    const set = withEvents([sub('p3', 'p8')]);
    expect(lineupOf(set)).toBe('1 2 8 4 5 6');
    expect(replaySet(set, players)).toMatchObject({ subsUsed: 1, warnings: [] });
  });

  it('the substitute serves when rotated to position 1', () => {
    const set = withEvents([sub('p2', 'p8'), pt('them'), pt('us')]);
    expect(replaySet(set, players).serverId).toBe('p8');
  });

  it(`allows ${MAX_SUBS_PER_SET} per set and warns about the 7th`, () => {
    const six = [
      sub('p1', 'p8'),
      sub('p2', 'p9'),
      sub('p3', 'p10'),
      sub('p8', 'p1'),
      sub('p9', 'p2'),
      sub('p4', 'p11'),
    ];
    expect(replaySet(withEvents(six), players)).toMatchObject({ subsUsed: 6, warnings: [] });
    const seven = withEvents([...six, sub('p5', 'p12')]);
    const state = replaySet(seven, players);
    expect(state.subsUsed).toBe(7);
    expect(state.warnings).toEqual([
      { code: 'SUB_LIMIT', eventIndex: 6, outPlayerId: 'p5', inPlayerId: 'p12' },
    ]);
    expect(lineupOf(seven)).toBe('1 2 10 11 12 6'); // still applied: a warning, not a block
  });

  it('re-entry: a substitute may only be replaced by the player they came in for', () => {
    const state = replaySet(withEvents([sub('p5', 'p8'), sub('p8', 'p9')]), players);
    expect(state.warnings).toEqual([
      { code: 'REENTRY_RULE', eventIndex: 1, outPlayerId: 'p8', inPlayerId: 'p9' },
    ]);
    expect(state.subsUsed).toBe(2);
  });

  it('re-entry: a player who was subbed out may only come back for their substitute', () => {
    const events = [sub('p5', 'p8'), sub('p3', 'p5')];
    const state = replaySet(withEvents(events), players);
    expect(state.warnings.map((w) => w.code)).toEqual(['REENTRY_RULE']);
    expect(lineupOf(withEvents(events))).toBe('1 2 5 4 8 6');
  });

  it('re-entry: a pair can be used only twice (out and back)', () => {
    const back = withEvents([sub('p5', 'p8'), sub('p8', 'p5')]);
    expect(replaySet(back, players).warnings).toEqual([]);
    const again = replaySet(addSub(back, 'p5', 'p8'), players);
    expect(again.warnings).toEqual([
      { code: 'REENTRY_RULE', eventIndex: 2, outPlayerId: 'p5', inPlayerId: 'p8' },
    ]);
  });

  it('skips substitutions that cannot be applied, with INVALID_SUB', () => {
    const events = [
      sub('p8', 'p9'), // p8 is not on court
      sub('p1', 'p2'), // p2 is already on court
      sub('p1', 'p7'), // the libero is not a substitute
      sub('p1', 'ghost'), // unknown player
      sub('ghost', 'p8'),
    ];
    const state = replaySet(withEvents(events), players);
    expect(state.subsUsed).toBe(0);
    expect(state.warnings.map((w) => [w.code, w.reason])).toEqual([
      ['INVALID_SUB', 'OUT_NOT_ON_COURT'],
      ['INVALID_SUB', 'IN_ON_COURT'],
      ['INVALID_SUB', 'IN_IS_LIBERO'],
      ['INVALID_SUB', 'UNKNOWN_PLAYER'],
      ['INVALID_SUB', 'UNKNOWN_PLAYER'],
    ]);
    expect(lineupOf(withEvents(events))).toBe('1 2 3 4 5 6');
  });

  it('previewSub tells what a substitution would trigger', () => {
    const set = withEvents([sub('p5', 'p8')]);
    expect(previewSub(set, players, 'p8', 'p5')).toEqual([]);
    expect(previewSub(set, players, 'p8', 'p9')).toEqual(['REENTRY_RULE']);
    expect(previewSub(set, players, 'p9', 'p10')).toEqual(['INVALID_SUB']);
    expect(set.events).toHaveLength(1);
  });
});

describe('event helpers', () => {
  it('addPoint / addSub append without mutating', () => {
    const set = baseSet();
    const next = addSub(addPoint(set, 'them'), 'p1', 'p8');
    expect(set.events).toEqual([]);
    expect(next.events).toEqual([pt('them'), sub('p1', 'p8')]);
  });

  it('undo drops the last event and keeps an empty set unchanged', () => {
    const set = baseSet();
    expect(undo(set)).toBe(set);
    const two = withEvents([pt('us'), sub('p1', 'p8')]);
    expect(undo(two).events).toEqual([pt('us')]);
    expect(two.events).toHaveLength(2);
  });
});

describe('liveCourtView — libero swaps on the live court', () => {
  const numbers = (slots: Record<number, string | null>) =>
    [1, 2, 3, 4, 5, 6].map((p) => (slots[p] ?? '-').slice(1)).join(' ');
  // p3 and p6 are the middles the libero (p7) replaces.
  const libero = { liberoReplaces: ['p3', 'p6'] };

  it('puts the libero in for a chosen back-row starter', () => {
    // Start: p6 is at position 6 (back row), p3 at 3 (front row).
    const set = withEvents([], libero);
    const view = liveCourtView(set, replaySet(set, players));
    expect(numbers(view.slots)).toBe('1 2 3 4 5 7');
    expect(view.liberoSwap).toEqual({ position: 6, replacedId: 'p6' });
  });

  it('never lets the libero serve, but takes position 1 while the opponent serves', () => {
    // After 5 side-outs p6 is at position 1 (rotation 6).
    const sideOuts = Array.from({ length: 5 }, () => [pt('them'), pt('us')]).flat();
    const serving = withEvents(sideOuts, libero);
    const servingState = replaySet(serving, players);
    expect(servingState.serverId).toBe('p6');
    const servingView = liveCourtView(serving, servingState);
    // p6 serves; p3 is at position 4 (front): no swap.
    expect(numbers(servingView.slots)).toBe('6 1 2 3 4 5');
    expect(servingView.liberoSwap).toBeNull();

    const receiving = addPoint(serving, 'them');
    const view = liveCourtView(receiving, replaySet(receiving, players));
    expect(numbers(view.slots)).toBe('7 1 2 3 4 5');
    expect(view.liberoSwap).toEqual({ position: 1, replacedId: 'p6' });
  });

  it('swaps for a substitute of a chosen starter (they take over the role, v4.0 #130)', () => {
    const set = withEvents([sub('p6', 'p8')], libero);
    const state = replaySet(set, players);
    expect(state.liberoReplaces).toEqual(['p3', 'p8']);
    const view = liveCourtView(set, state);
    expect(numbers(view.slots)).toBe('1 2 3 4 5 7');
    expect(view.liberoSwap).toEqual({ position: 6, replacedId: 'p8' });
    // the starter coming back is replaced again
    const back = withEvents([sub('p6', 'p8'), sub('p8', 'p6')], libero);
    expect(replaySet(back, players).liberoReplaces).toEqual(['p3', 'p6']);
    // an invalid sub changes nothing; a switched-off libero replaces nobody
    expect(replaySet(withEvents([sub('p8', 'p9')], libero), players).liberoReplaces).toEqual([
      'p3',
      'p6',
    ]);
    const off = { ...set, liberoActive: false };
    expect(replaySet(off, players).liberoReplaces).toEqual([]);
    expect(liveCourtView(off, replaySet(off, players)).liberoSwap).toBeNull();
  });

  it('shows the real court when there is no libero', () => {
    const set = withEvents([], { liberoId: null, liberoReplaces: ['p6'] });
    const view = liveCourtView(set, replaySet(set, players));
    expect(numbers(view.slots)).toBe('1 2 3 4 5 6');
    expect(view.liberoSwap).toBeNull();
  });
});

describe('addPoint timestamps (v4)', () => {
  it('stores the time a rally was recorded only when given', () => {
    const base = emptySetLineup(1);
    expect(addPoint(base, 'us').events).toEqual([{ type: 'point', winner: 'us' }]);
    expect(addPoint(base, 'them', '2026-11-21T10:00:00.000Z').events).toEqual([
      { type: 'point', winner: 'them', at: '2026-11-21T10:00:00.000Z' },
    ]);
  });
});

describe('replaySteps — every event with the state it was played in', () => {
  it('gives each rally its rotation, serving side and court before any side-out', () => {
    const set = withEvents([pt('them'), pt('us'), sub('p2', 'p8'), sub('p9', 'p10'), pt('us')], {
      weServeFirst: false,
    });
    const steps = replaySteps(set, players);
    expect(steps.map((s) => [s.type, s.eventIndex])).toEqual([
      ['point', 0],
      ['point', 1],
      ['sub', 2],
      ['sub', 3],
      ['point', 4],
    ]);
    const rallies = steps.flatMap((s) => (s.type === 'point' ? [s] : []));
    expect(rallies.map((r) => [r.rotation, r.servingSide, r.slots[1]])).toEqual([
      [1, 'them', 'p1'],
      [1, 'them', 'p1'],
      [2, 'us', 'p8'],
    ]);
    expect(steps.flatMap((s) => (s.type === 'sub' ? [s.applied] : []))).toEqual([true, false]);
  });

  it('leaves the live state unchanged', () => {
    const set = withEvents([pt('us'), pt('them'), pt('us')]);
    expect(replaySteps(set, players)).toHaveLength(3);
    expect(replaySet(set, players).score).toEqual({ us: 2, them: 1 });
  });
});
