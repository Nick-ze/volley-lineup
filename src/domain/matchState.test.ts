import { emptySetLineup } from './lineup';
import {
  durationOf,
  getMatchState,
  lastPlayedSetNumber,
  setResult,
  setScore,
  setWinner,
  SETS_TO_WIN,
} from './matchState';
import type { Match, SetEvent, SetLineup, SetNumber, Side } from './types';

/** Points in order: 'u' = us, 't' = them (e.g. "uut"). */
function rallies(sequence: string, at?: (i: number) => string): SetEvent[] {
  return [...sequence].map((c, i): SetEvent => {
    const winner: Side = c === 'u' ? 'us' : 'them';
    return at ? { type: 'point', winner, at: at(i) } : { type: 'point', winner };
  });
}

/** A set ending us:them, with the winner scoring last (losers' points first, then alternating). */
function playedSet(setNumber: SetNumber, us: number, them: number): SetLineup {
  const winnerChar = us > them ? 'u' : 't';
  const loserChar = winnerChar === 'u' ? 't' : 'u';
  const loser = Math.min(us, them);
  const winner = Math.max(us, them);
  // alternate up to loser:loser, then the winner scores the rest
  const events = rallies(
    `${(winnerChar + loserChar).repeat(loser)}${winnerChar.repeat(winner - loser)}`,
  );
  return { ...emptySetLineup(setNumber), events };
}

const match = (sets: SetLineup[]): Pick<Match, 'sets'> => ({ sets });

describe('setScore / setWinner', () => {
  it('counts points only (subs are ignored)', () => {
    const set: SetLineup = {
      ...emptySetLineup(1),
      events: [...rallies('uut'), { type: 'sub', outPlayerId: 'a', inPlayerId: 'b' }],
    };
    expect(setScore(set)).toEqual({ us: 2, them: 1 });
    expect(setWinner(set)).toBeNull();
  });

  it('a set is won at 25 with a 2-point lead, and at 15 in set 5', () => {
    expect(setWinner(playedSet(1, 25, 23))).toBe('us');
    expect(setWinner(playedSet(2, 19, 25))).toBe('them');
    expect(setWinner(playedSet(5, 15, 13))).toBe('us');
    expect(setWinner({ ...emptySetLineup(1), events: rallies('u'.repeat(15)) })).toBeNull();
  });

  it('deuce: 25:24 is open, 26:24 and 31:29 are won', () => {
    const deuce = (us: number, them: number) => {
      const set = emptySetLineup(3);
      // alternate to 24:24, then extra points
      const base = 'ut'.repeat(24);
      const rest = `${'u'.repeat(us - 24)}${'t'.repeat(them - 24)}`;
      return { ...set, events: rallies(base + rest) };
    };
    expect(setResult(deuce(25, 24))).toEqual({
      setNumber: 3,
      score: { us: 25, them: 24 },
      winner: null,
      status: 'inProgress',
    });
    expect(setWinner(deuce(26, 24))).toBe('us');
    const long: SetLineup = { ...emptySetLineup(2), events: rallies(`${'ut'.repeat(29)}tt`) };
    expect(setResult(long)).toMatchObject({ score: { us: 29, them: 31 }, status: 'lost' });
  });

  it('an empty set is not started', () => {
    expect(setResult(emptySetLineup(4))).toEqual({
      setNumber: 4,
      score: { us: 0, them: 0 },
      winner: null,
      status: 'notStarted',
    });
  });
});

describe('getMatchState', () => {
  it('a match without points is not started and starts with set 1', () => {
    expect(getMatchState(match([emptySetLineup(1)]))).toEqual({
      sets: [{ setNumber: 1, score: { us: 0, them: 0 }, winner: null, status: 'notStarted' }],
      setsWon: { us: 0, them: 0 },
      winner: null,
      status: 'notStarted',
      currentSetNumber: 1,
      durationMs: null,
    });
    expect(getMatchState(match([])).currentSetNumber).toBe(1);
  });

  it('3:0 — won after three sets', () => {
    const state = getMatchState(
      match([playedSet(1, 25, 20), playedSet(2, 25, 18), playedSet(3, 27, 25)]),
    );
    expect(SETS_TO_WIN).toBe(3);
    expect(state.setsWon).toEqual({ us: 3, them: 0 });
    expect(state.winner).toBe('us');
    expect(state.status).toBe('won');
    expect(state.currentSetNumber).toBeNull();
    expect(state.sets.map((s) => s.score)).toEqual([
      { us: 25, them: 20 },
      { us: 25, them: 18 },
      { us: 27, them: 25 },
    ]);
  });

  it('3:2 with a 15-point tiebreak and deuce sets', () => {
    const state = getMatchState(
      match([
        playedSet(1, 26, 28),
        playedSet(2, 25, 21),
        playedSet(3, 23, 25),
        playedSet(4, 30, 28),
        playedSet(5, 15, 12),
      ]),
    );
    expect(state.setsWon).toEqual({ us: 3, them: 2 });
    expect(state.status).toBe('won');
    expect(state.sets.map((s) => s.winner)).toEqual(['them', 'us', 'them', 'us', 'us']);
    expect(state.sets[4].score).toEqual({ us: 15, them: 12 });
  });

  it('1:3 lost', () => {
    const state = getMatchState(
      match([
        playedSet(1, 25, 22),
        playedSet(2, 20, 25),
        playedSet(3, 21, 25),
        playedSet(4, 24, 26),
      ]),
    );
    expect(state.setsWon).toEqual({ us: 1, them: 3 });
    expect(state.winner).toBe('them');
    expect(state.status).toBe('lost');
  });

  it('in progress: the current set is the first undecided one, stored or not', () => {
    const open = { ...emptySetLineup(3), events: rallies('uut') };
    const state = getMatchState(match([playedSet(2, 18, 25), open, playedSet(1, 25, 10)]));
    expect(state.status).toBe('inProgress');
    expect(state.setsWon).toEqual({ us: 1, them: 1 });
    expect(state.sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
    expect(state.currentSetNumber).toBe(3);
    // two sets won, set 3 not stored yet
    expect(
      getMatchState(match([playedSet(1, 25, 10), playedSet(2, 25, 10)])).currentSetNumber,
    ).toBe(3);
  });

  it('undoing the winning point re-opens the set', () => {
    const won = playedSet(1, 25, 20);
    const undone = { ...won, events: won.events.slice(0, -1) };
    expect(getMatchState(match([undone, emptySetLineup(2)]))).toMatchObject({
      setsWon: { us: 0, them: 0 },
      currentSetNumber: 1,
      status: 'inProgress',
    });
  });

  it('ignores sets stored after the deciding set (old data)', () => {
    const state = getMatchState(
      match([playedSet(1, 25, 1), playedSet(2, 25, 1), playedSet(3, 25, 1), playedSet(4, 1, 25)]),
    );
    expect(state.sets).toHaveLength(3);
    expect(state.setsWon).toEqual({ us: 3, them: 0 });
  });

  it('duration: from the first to the last timestamped rally of the counted sets', () => {
    const stamp = (minute: number) => () =>
      `2026-11-21T18:${String(minute).padStart(2, '0')}:00.000Z`;
    const s1: SetLineup = { ...emptySetLineup(1), events: rallies('u', stamp(0)) };
    const s2: SetLineup = {
      ...emptySetLineup(2),
      events: [...rallies('t'), ...rallies('u', stamp(42))],
    };
    expect(getMatchState(match([s1, s2])).durationMs).toBe(42 * 60 * 1000);
    expect(durationOf([s1])).toBeNull();
    const bad: SetLineup = {
      ...emptySetLineup(3),
      events: [{ type: 'point', winner: 'us', at: 'x' }],
    };
    expect(durationOf([s1, bad])).toBeNull();
  });
});

describe('lastPlayedSetNumber', () => {
  it('is the highest set with points', () => {
    expect(lastPlayedSetNumber(match([]))).toBeNull();
    const subOnly: SetLineup = {
      ...emptySetLineup(3),
      events: [{ type: 'sub', outPlayerId: 'a', inPlayerId: 'b' }],
    };
    expect(lastPlayedSetNumber(match([playedSet(2, 25, 3), playedSet(1, 25, 3), subOnly]))).toBe(2);
    expect(lastPlayedSetNumber(match([playedSet(1, 25, 3), emptySetLineup(2)]))).toBe(1);
    expect(lastPlayedSetNumber(match([playedSet(1, 25, 3), playedSet(3, 25, 3)]))).toBe(3);
  });
});
