import { lastRally, plausibleKinds, plausiblePlayerIds } from './lastRally';
import type { Player, SetLineup } from './types';

const player = (n: number): Player => ({
  id: `p${n}`,
  teamId: 't',
  firstName: '',
  lastName: `P${n}`,
  number: n,
  positions: ['OH'],
  active: true,
});
const players = [1, 2, 3, 4, 5, 6, 7].map(player);

const base: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: [],
  weServeFirst: true,
  events: [],
};
const set = (over: Partial<SetLineup>): SetLineup => ({ ...base, ...over });

describe('lastRally', () => {
  it('is null without events or when the last event is a substitution', () => {
    expect(lastRally(base, players)).toBeNull();
    const sub = set({
      events: [
        { type: 'point', winner: 'us' },
        { type: 'sub', outPlayerId: 'p2', inPlayerId: 'p7' },
      ],
    });
    expect(lastRally(sub, players)).toBeNull();
  });

  it('returns the rally, the players on court and our server', () => {
    const s = set({ events: [{ type: 'point', winner: 'us', kind: 'ace', playerId: 'p1' }] });
    expect(lastRally(s, players)).toEqual({
      event: { type: 'point', winner: 'us', kind: 'ace', playerId: 'p1' },
      servingSide: 'us',
      playerIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'],
      serverId: 'p1',
      frontRowIds: ['p2', 'p3', 'p4'],
      liberoId: 'p7',
    });
  });

  it('applies the libero swap of the rally', () => {
    const s = set({ liberoReplaces: ['p6'], events: [{ type: 'point', winner: 'them' }] });
    expect(lastRally(s, players)?.playerIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p7']);
  });

  it('uses the court before the side-out the rally caused (they served)', () => {
    // They serve; the libero receives in place of p1 at position 1. Winning rotates p2 to serve.
    const s = set({
      weServeFirst: false,
      liberoReplaces: ['p1'],
      events: [{ type: 'point', winner: 'us' }],
    });
    expect(lastRally(s, players)).toEqual({
      event: { type: 'point', winner: 'us' },
      servingSide: 'them',
      playerIds: ['p7', 'p2', 'p3', 'p4', 'p5', 'p6'],
      serverId: null,
      frontRowIds: ['p2', 'p3', 'p4'],
      liberoId: 'p7',
    });
  });

  it('skips empty positions', () => {
    const s = set({
      slots: { ...base.slots, 6: null },
      events: [{ type: 'point', winner: 'us' }],
    });
    expect(lastRally(s, players)?.playerIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });
});

describe('plausibleKinds', () => {
  const rally = (winner: 'us' | 'them', servingSide: 'us' | 'them') => ({
    event: { type: 'point' as const, winner },
    servingSide,
  });

  it('offers our ace only on our serve', () => {
    expect(plausibleKinds(rally('us', 'us'))).toEqual(['kill', 'ace', 'block', 'opponentError']);
    expect(plausibleKinds(rally('us', 'them'))).toEqual(['kill', 'block', 'opponentError']);
  });

  it('offers their ace only on their serve', () => {
    expect(plausibleKinds(rally('them', 'them'))).toEqual([
      'ourError',
      'opponentKill',
      'opponentAce',
    ]);
    expect(plausibleKinds(rally('them', 'us'))).toEqual(['ourError', 'opponentKill']);
  });
});

describe('plausiblePlayerIds (rules check #35)', () => {
  // They serve, the libero p7 receives in place of p6 at 6; p1 at 1, front row p2 p3 p4.
  const receiving = lastRally(
    set({ weServeFirst: false, liberoReplaces: ['p6'], events: [{ type: 'point', winner: 'us' }] }),
    players,
  )!;
  // We serve with p1; the libero p7 is in for p5 at 5.
  const serving = lastRally(
    set({ liberoReplaces: ['p5'], events: [{ type: 'point', winner: 'us' }] }),
    players,
  )!;

  it('block: only front-row players (2, 3, 4), never the libero', () => {
    expect(plausiblePlayerIds(receiving, 'block')).toEqual(['p2', 'p3', 'p4']);
    expect(plausiblePlayerIds({ ...serving, frontRowIds: ['p2', 'p7'] }, 'block')).toEqual(['p2']);
    const partial = lastRally(
      set({ slots: { ...base.slots, 3: null }, events: [{ type: 'point', winner: 'us' }] }),
      players,
    )!;
    expect(plausiblePlayerIds(partial, 'block')).toEqual(['p2', 'p4']);
  });

  it('ace: only our server of the rally (none when they served)', () => {
    expect(plausiblePlayerIds(serving, 'ace')).toEqual(['p1']);
    expect(plausiblePlayerIds(receiving, 'ace')).toEqual([]);
  });

  it('kill: anyone on court except the libero', () => {
    expect(plausiblePlayerIds(receiving, 'kill')).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(plausiblePlayerIds(serving, 'kill')).toEqual(['p1', 'p2', 'p3', 'p4', 'p6']);
  });

  it('our error: anyone on court, the libero included', () => {
    expect(plausiblePlayerIds(receiving, 'ourError')).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p7']);
  });

  it('kinds without a player offer nobody', () => {
    expect(plausiblePlayerIds(receiving, 'opponentError')).toEqual([]);
    expect(plausiblePlayerIds(receiving, 'opponentKill')).toEqual([]);
  });

  it('keeps a player already tagged with this kind, even an implausible one', () => {
    const tagged = {
      ...receiving,
      event: { ...receiving.event, kind: 'block' as const, playerId: 'p5' },
    };
    expect(plausiblePlayerIds(tagged, 'block')).toEqual(['p2', 'p3', 'p4', 'p5']);
    const plausible = {
      ...receiving,
      event: { ...receiving.event, kind: 'block' as const, playerId: 'p3' },
    };
    expect(plausiblePlayerIds(plausible, 'block')).toEqual(['p2', 'p3', 'p4']);
    // A tag of another kind doesn't count.
    const other = {
      ...receiving,
      event: { ...receiving.event, kind: 'kill' as const, playerId: 'p5' },
    };
    expect(plausiblePlayerIds(other, 'block')).toEqual(['p2', 'p3', 'p4']);
  });
});
