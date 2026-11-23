/**
 * v8.3 (AUDIT A1): identity caches of derived data. A cached result must be the same as a fresh
 * one, be reused only for the very same objects, and never be changed by the code that reads it.
 */
import * as fs from 'fs';
import * as path from 'path';

import { lastRally } from './lastRally';
import { replaySet, replaySteps } from './liveSet';
import { getMatchState, setResult } from './matchState';
import { memoByIdentity, memoByIdentity2 } from './memo';
import {
  combinePerformance,
  matchPerformance,
  performanceRows,
  playerSeason,
  setPerformance,
} from './performance';
import { opponentRecords } from './seasons';
import {
  combineStats,
  countedSets,
  matchStats,
  playedSetNumbers,
  playerStatRows,
  seasonOverview,
  seasonStats,
  setStats,
} from './stats';
import type { Match, Opponent, Player } from './types';

interface Data {
  matches: Match[];
  players: Player[];
  opponents: Opponent[];
}

/** Realistic data (the export golden's input): tags, subs, libero, timestamps. */
const load = (): Data =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '__golden__', 'input.json'), 'utf8'));

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/** Everything derived from the data, as the screens use it. */
function derive({ matches, players, opponents }: Data) {
  const teamPlayers = players.filter((p) => p.teamId === 't1');
  const teamMatches = matches.filter((m) => m.teamId === 't1');
  return {
    states: matches.map((m) => getMatchState(m)),
    counted: matches.map((m) => countedSets(m)),
    played: matches.map((m) => playedSetNumbers(m)),
    stats: teamMatches.map((m) => matchStats(m, teamPlayers)),
    set1Stats: teamMatches.map((m) => matchStats(m, teamPlayers, 1)),
    perf: teamMatches.map((m) => matchPerformance(m, teamPlayers)),
    set1Perf: teamMatches.map((m) => matchPerformance(m, teamPlayers, 1)),
    season: seasonStats(teamMatches, teamPlayers),
    overview: seasonOverview(teamMatches),
    seasonRows: playerStatRows(seasonStats(teamMatches, teamPlayers), teamPlayers),
    perfRows: performanceRows(matchPerformance(teamMatches[0] as Match, teamPlayers), teamPlayers),
    playerSeason: teamPlayers.map((p) => playerSeason(teamMatches, teamPlayers, p.id)),
    opponents: opponentRecords(opponents, teamMatches, 's1'),
    replays: teamMatches.flatMap((m) =>
      m.sets.map((s) => ({
        state: replaySet(s, teamPlayers),
        steps: replaySteps(s, teamPlayers),
        last: lastRally(s, teamPlayers),
      })),
    ),
  };
}

describe('memoByIdentity', () => {
  it('computes once per object and returns the same result', () => {
    const fn = jest.fn((o: { n: number }) => ({ double: o.n * 2 }));
    const cached = memoByIdentity(fn);
    const a = { n: 1 };
    const first = cached(a);
    expect(cached(a)).toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
    // An equal but different object is computed again.
    const b = { n: 1 };
    expect(cached(b)).not.toBe(first);
    expect(cached(b)).toEqual(first);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('caches undefined and null results', () => {
    const fn = jest.fn((o: { n: number }) => (o.n > 0 ? null : undefined));
    const cached = memoByIdentity(fn);
    const a = { n: 1 };
    const b = { n: 0 };
    expect(cached(a)).toBeNull();
    expect(cached(a)).toBeNull();
    expect(cached(b)).toBeUndefined();
    expect(cached(b)).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('memoByIdentity2', () => {
  it('keys on both arguments', () => {
    const fn = jest.fn((a: { n: number }, b: readonly number[]) => a.n + b.length);
    const cached = memoByIdentity2(fn);
    const a = { n: 1 };
    const b1 = [1];
    const b2 = [1];
    expect(cached(a, b1)).toBe(2);
    expect(cached(a, b1)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cached(a, b2)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(cached({ n: 1 }, b1)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(cached(a, b2)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('cached domain results', () => {
  it('reuse the result for the same objects only', () => {
    const { matches, players } = load();
    const match = matches[0] as Match;
    const set = match.sets[0] as Match['sets'][number];
    expect(getMatchState(match)).toBe(getMatchState(match));
    // An unchanged match keeps its sets array: a new match object reuses the result.
    const renamed: Match = { ...match, opponent: 'Renamed' };
    expect(getMatchState(renamed)).toBe(getMatchState(match));
    expect(getMatchState({ sets: [...match.sets] })).not.toBe(getMatchState(match));
    expect(getMatchState({ sets: [...match.sets] })).toEqual(getMatchState(match));
    expect(countedSets(match)).toBe(countedSets(match));
    expect(setResult(set)).toBe(setResult(set));
    expect(replaySet(set, players)).toBe(replaySet(set, players));
    expect(replaySteps(set, players)).toBe(replaySteps(set, players));
    expect(setStats(set, players)).toBe(setStats(set, players));
    expect(setPerformance(set, players)).toBe(setPerformance(set, players));
    // Another players array is another key: computed again, with the same content.
    const copy = [...players];
    expect(setStats(set, copy)).not.toBe(setStats(set, players));
    expect(setStats(set, copy)).toEqual(setStats(set, players));
    expect(setPerformance(set, copy)).not.toBe(setPerformance(set, players));
    expect(replaySteps(set, copy)).not.toBe(replaySteps(set, players));
  });

  it('follow a changed set (a new event makes new objects)', () => {
    const { matches, players } = load();
    const match = matches[0] as Match;
    const before = getMatchState(match);
    const [first, ...rest] = match.sets;
    const changed = { ...match, sets: [{ ...first!, events: [] }, ...rest] };
    const after = getMatchState(changed);
    expect(after).not.toBe(before);
    expect(after.sets[0]?.score).toEqual({ us: 0, them: 0 });
    expect(setStats(changed.sets[0]!, players).points).toEqual({ us: 0, them: 0 });
  });

  it('are never changed by the code that reads them (frozen data and results)', () => {
    const fresh = derive(load());
    const data = deepFreeze(load());
    // Freeze every cached result too: a write anywhere would throw (strict mode).
    for (const m of data.matches) {
      deepFreeze(getMatchState(m));
      deepFreeze(countedSets(m));
      for (const s of m.sets) {
        deepFreeze(setResult(s));
        deepFreeze(replaySet(s, data.players));
        deepFreeze(replaySteps(s, data.players));
        deepFreeze(setStats(s, data.players));
        deepFreeze(setPerformance(s, data.players));
      }
    }
    const first = derive(data);
    const again = derive(data);
    expect(first).toEqual(fresh);
    expect(again).toEqual(fresh);
  });

  it('are added up into new objects', () => {
    const { matches, players } = load();
    const sets = (matches[0] as Match).sets;
    const stats = sets.map((s) => setStats(s, players));
    const perf = sets.map((s) => setPerformance(s, players));
    const snapshot = JSON.stringify([stats, perf]);
    const total = combineStats(stats);
    const perfTotal = combinePerformance(perf);
    expect(stats).not.toContain(total);
    expect(perf).not.toContain(perfTotal);
    expect(combineStats([stats[0]!])).not.toBe(stats[0]);
    expect(combinePerformance([perf[0]!])).not.toBe(perf[0]);
    expect(JSON.stringify([stats, perf])).toBe(snapshot);
  });
});
