import { emptySetLineup } from './lineup';
import { isPlayerInPlayedSet, isPlayerInSet, removePlayerEverywhere } from './playerUsage';
import type { Match, SetLineup } from './types';

const starters = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' } as const;
const set = (extra: Partial<SetLineup> = {}): SetLineup => ({
  ...emptySetLineup(1),
  slots: { ...starters },
  liberoId: 'l',
  ...extra,
});
const match = (sets: SetLineup[]): Match => ({
  id: 'm',
  teamId: 't',
  opponent: 'X',
  date: '2026-11-21',
  home: true,
  sets,
});

describe('isPlayerInSet', () => {
  it('finds starters, the libero and substitution players', () => {
    const s = set({ events: [{ type: 'sub', outPlayerId: 'a', inPlayerId: 'z' }] });
    expect(isPlayerInSet(s, 'c')).toBe(true);
    expect(isPlayerInSet(s, 'l')).toBe(true);
    expect(isPlayerInSet(s, 'z')).toBe(true);
    expect(isPlayerInSet(s, 'nobody')).toBe(false);
    expect(isPlayerInSet(set({ events: [{ type: 'point', winner: 'us' }] }), 'z')).toBe(false);
  });
});

describe('isPlayerInPlayedSet', () => {
  it('only counts sets that have live events', () => {
    const unplayed = set();
    const played = set({ setNumber: 2, events: [{ type: 'point', winner: 'us' }] });
    expect(isPlayerInPlayedSet([match([unplayed])], 'a')).toBe(false);
    expect(isPlayerInPlayedSet([match([unplayed, played])], 'a')).toBe(true);
    expect(isPlayerInPlayedSet([match([played])], 'nobody')).toBe(false);
    expect(isPlayerInPlayedSet([], 'a')).toBe(false);
  });
});

describe('removePlayerEverywhere', () => {
  it('clears court, libero, libero replacements and substitutions', () => {
    const s = set({
      liberoReplaces: ['c', 'f'],
      events: [
        { type: 'point', winner: 'us' },
        { type: 'sub', outPlayerId: 'c', inPlayerId: 'z' },
        { type: 'sub', outPlayerId: 'b', inPlayerId: 'y' },
      ],
    });
    const out = removePlayerEverywhere(s, 'c');
    expect(out.slots[3]).toBeNull();
    expect(out.liberoReplaces).toEqual(['f']);
    expect(out.events).toEqual([
      { type: 'point', winner: 'us' },
      { type: 'sub', outPlayerId: 'b', inPlayerId: 'y' },
    ]);
    expect(removePlayerEverywhere(s, 'l').liberoId).toBeNull();
  });

  it('removes a bench player who only appears in a substitution', () => {
    const s = set({ events: [{ type: 'sub', outPlayerId: 'a', inPlayerId: 'z' }] });
    expect(removePlayerEverywhere(s, 'z').events).toEqual([]);
  });

  it('removes a stale libero replacement for someone not on court', () => {
    const s = set({ liberoReplaces: ['gone'] });
    expect(removePlayerEverywhere(s, 'gone').liberoReplaces).toEqual([]);
  });

  it('returns the same object when the player is not referenced', () => {
    const s = set({ liberoReplaces: ['c'] });
    expect(removePlayerEverywhere(s, 'nobody')).toBe(s);
  });
});
