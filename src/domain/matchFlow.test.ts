import { emptySetLineup } from './lineup';
import {
  decidingSetNumber,
  defaultWeServeFirst,
  hasLaterPlay,
  isAfterDecision,
  isSetComplete,
  liveSetNumber,
  needsSetup,
  nextSetNumber,
  setupSources,
  undoTarget,
  withDefaultServe,
} from './matchFlow';
import { getMatchState } from './matchState';
import type { LineupPreset, Match, SetEvent, SetLineup, SetNumber, Side } from './types';

const full = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' } as const;

const points = (winner: Side, n: number): SetEvent[] =>
  Array.from({ length: n }, () => ({ type: 'point', winner }));

const set = (
  setNumber: SetNumber,
  us = 0,
  them = 0,
  extra: Partial<SetLineup> = {},
): SetLineup => ({
  ...emptySetLineup(setNumber),
  slots: { ...full },
  events: [...points('us', us), ...points('them', them)],
  ...extra,
});

const match = (sets: SetLineup[]): Pick<Match, 'sets' | 'teamId'> => ({ teamId: 't1', sets });

const preset = (over: Partial<LineupPreset>): LineupPreset => ({
  id: 'x',
  teamId: 't1',
  name: '',
  kind: 'preset',
  slots: { ...full },
  liberoId: null,
  liberoReplaces: [],
  createdAt: '2026-01-01',
  ...over,
});

describe('isSetComplete', () => {
  it('needs all six positions', () => {
    expect(isSetComplete(set(1))).toBe(true);
    expect(isSetComplete(emptySetLineup(1))).toBe(false);
    expect(isSetComplete({ slots: { ...full, 4: null } })).toBe(false);
  });
});

describe('decidingSetNumber', () => {
  it('is the last counted set once the match is won, else null', () => {
    const won = match([set(1, 25, 20), set(2, 20, 25), set(3, 25, 10), set(4, 26, 24)]);
    expect(decidingSetNumber(getMatchState(won))).toBe(4);
    expect(decidingSetNumber(getMatchState(match([set(1, 25, 20)])))).toBeNull();
  });
});

describe('liveSetNumber', () => {
  const m = match([set(1, 25, 20), set(2, 3, 1)]);
  it('uses a valid requested set', () => {
    expect(liveSetNumber(m, '1')).toBe(1);
    expect(liveSetNumber(m, ['5'])).toBe(5);
  });
  it('falls back to the current set for a missing or invalid request', () => {
    expect(liveSetNumber(m, undefined)).toBe(2);
    expect(liveSetNumber(m, '9')).toBe(2);
    expect(liveSetNumber(m, 'x')).toBe(2);
    expect(liveSetNumber(match([]), undefined)).toBe(1);
    expect(liveSetNumber(match([set(1, 25, 0)]), undefined)).toBe(2);
  });
  it('goes to the deciding set once the match is over', () => {
    const over = match([set(1, 25, 0), set(2, 25, 0), set(3, 25, 0)]);
    expect(liveSetNumber(over, undefined)).toBe(3);
  });
});

describe('needsSetup', () => {
  it('is true for the current set when it is missing or incomplete and unplayed', () => {
    expect(needsSetup(match([set(1, 25, 20)]), 2)).toBe(true);
    const incomplete = { ...emptySetLineup(2), slots: { ...full, 6: null } };
    expect(needsSetup(match([set(1, 25, 20), incomplete]), 2)).toBe(true);
  });
  it('is false for a complete set, a set with events, or a set that is not current', () => {
    expect(needsSetup(match([set(1, 25, 20), set(2)]), 2)).toBe(false);
    const played = { ...set(2, 1, 0), slots: { ...full, 6: null } };
    expect(needsSetup(match([set(1, 25, 20), played]), 2)).toBe(false);
    expect(needsSetup(match([set(1, 2, 0)]), 2)).toBe(false);
    expect(needsSetup(match([set(1, 25, 0), set(2, 25, 0), set(3, 25, 0)]), 4)).toBe(false);
  });
});

describe('nextSetNumber', () => {
  it('counts up to 5', () => {
    expect(nextSetNumber(1)).toBe(2);
    expect(nextSetNumber(4)).toBe(5);
    expect(nextSetNumber(5)).toBeNull();
  });
});

describe('defaultWeServeFirst', () => {
  it('lets the team that received first in the previous set serve', () => {
    expect(defaultWeServeFirst({ weServeFirst: true })).toBe(false);
    expect(defaultWeServeFirst({ weServeFirst: false })).toBe(true);
    expect(defaultWeServeFirst(null)).toBe(true);
  });
});

describe('hasLaterPlay', () => {
  it('looks for events in later sets', () => {
    const m = match([
      set(1, 25, 20),
      set(2),
      set(3, 0, 0, { events: [{ type: 'sub', outPlayerId: 'a', inPlayerId: 'z' }] }),
    ]);
    expect(hasLaterPlay(m, 1)).toBe(true);
    expect(hasLaterPlay(m, 3)).toBe(false);
    expect(hasLaterPlay(match([set(1, 25, 20), set(2)]), 1)).toBe(false);
  });
});

describe('undoTarget', () => {
  it('is the viewed set when it has events', () => {
    expect(undoTarget(match([set(1, 25, 20), set(2, 1, 0)]), 2)).toBe(2);
  });
  it('goes back to the previous won set when the viewed set is untouched', () => {
    expect(undoTarget(match([set(1, 25, 20)]), 2)).toBe(1);
    expect(undoTarget(match([set(1, 25, 20), set(2)]), 2)).toBe(1);
    expect(undoTarget(match([set(1, 25, 20), set(2, 20, 25), set(3)]), 3)).toBe(2);
  });
  it('is null when nothing can be undone', () => {
    expect(undoTarget(match([set(1)]), 1)).toBeNull();
    expect(undoTarget(match([]), 1)).toBeNull();
    expect(undoTarget(match([set(1, 5, 3)]), 2)).toBeNull(); // previous set still open
  });
});

describe('setupSources', () => {
  const starters = preset({ id: 's', kind: 'starters' });
  const b = preset({ id: 'b', name: 'Beta' });
  const a = preset({ id: 'a', name: 'Alpha' });
  const other = preset({ id: 'o', name: 'Other', teamId: 't2' });

  it('offers complete starters, the named presets by name and the previous set', () => {
    const s1 = set(1, 25, 20);
    const s2 = set(2, 20, 25);
    const sources = setupSources(match([s2, s1]), 3, [b, starters, a, other]);
    expect(sources.starters).toBe(starters);
    expect(sources.presets.map((p) => p.name)).toEqual(['Alpha', 'Beta']);
    expect(sources.previous).toBe(s2);
  });

  it('leaves out incomplete or missing starters and a missing previous set', () => {
    const partial = preset({ kind: 'starters', slots: { ...full, 2: null } });
    expect(setupSources(match([]), 1, [partial])).toEqual({
      starters: null,
      presets: [],
      previous: null,
    });
    expect(setupSources(match([set(2)]), 1, []).starters).toBeNull();
  });
});

describe('withDefaultServe', () => {
  it('applies the rotating default to a stored set without events', () => {
    const m = match([set(1, 25, 20), set(2)]); // we served first in set 1 → they serve in set 2
    expect(withDefaultServe(m, 2)).toEqual({ ...set(2), weServeFirst: false });
  });
  it('is null when there is nothing to change', () => {
    expect(
      withDefaultServe(match([set(1, 25, 20), { ...set(2), weServeFirst: false }]), 2),
    ).toBeNull();
    expect(withDefaultServe(match([set(1, 25, 20), set(2, 1, 0)]), 2)).toBeNull();
    expect(withDefaultServe(match([set(1, 25, 20)]), 2)).toBeNull();
    expect(withDefaultServe(match([set(2)]), 2)).toBeNull();
  });
});

describe('isAfterDecision', () => {
  it('marks sets stored after the deciding set', () => {
    const won = getMatchState(match([set(1, 25, 0), set(2, 25, 0), set(3, 25, 0), set(4)]));
    expect(isAfterDecision(won, 4)).toBe(true);
    expect(isAfterDecision(won, 3)).toBe(false);
    expect(isAfterDecision(getMatchState(match([set(1, 25, 0)])), 4)).toBe(false);
  });
});
