import { chooseLastErrorType } from './errorTagging';
import type { LastRally } from './lastRally';
import { emptySetLineup } from './lineup';
import type { PointEvent, SetLineup } from './types';

const withEvents = (events: SetLineup['events']): SetLineup => ({ ...emptySetLineup(1), events });
const last = (set: SetLineup) => set.events[set.events.length - 1];

/** We served: #1 at position 1; front row #2, #3, #4; the libero #7 in for #6 at position 5. */
const rally = (event: PointEvent, serverId: string | null = 'p1'): LastRally => ({
  event,
  servingSide: serverId === null ? 'them' : 'us',
  playerIds: ['p1', 'p2', 'p3', 'p4', 'p7', 'p5'],
  serverId,
  frontRowIds: ['p2', 'p3', 'p4'],
  liberoId: 'p7',
});
const lost: PointEvent = { type: 'point', winner: 'them' };
/** Chooses the type for a set whose only event is `event`. */
const choose = (
  event: PointEvent,
  type: Parameters<typeof chooseLastErrorType>[1],
  server?: string | null,
) => last(chooseLastErrorType(withEvents([event]), type, rally(event, server)));

describe('chooseLastErrorType', () => {
  it('names our server for a serve error when no player is tagged', () => {
    expect(choose(lost, 'serve')).toEqual({
      ...lost,
      kind: 'ourError',
      errorType: 'serve',
      playerId: 'p1',
    });
  });

  it('keeps a tagged player who could have made the error', () => {
    const server: PointEvent = { ...lost, kind: 'ourError', playerId: 'p1' };
    expect(choose(server, 'serve')).toEqual({ ...server, errorType: 'serve' });
    const front: PointEvent = { ...lost, kind: 'ourError', playerId: 'p3' };
    expect(choose(front, 'block')).toEqual({ ...front, errorType: 'block' });
    const libero: PointEvent = { ...lost, kind: 'ourError', playerId: 'p7' };
    expect(choose(libero, 'set')).toEqual({ ...libero, errorType: 'set' });
  });

  it('replaces a non-server with our server for a serve error', () => {
    const event: PointEvent = { ...lost, kind: 'ourError', playerId: 'p4' };
    expect(choose(event, 'serve')).toEqual({ ...event, errorType: 'serve', playerId: 'p1' });
  });

  it('drops a player who could not have made the error', () => {
    const libero: PointEvent = { ...lost, kind: 'ourError', playerId: 'p7' };
    expect(choose(libero, 'block')).toEqual({ ...lost, kind: 'ourError', errorType: 'block' });
    expect(choose(libero, 'attack')).toEqual({ ...lost, kind: 'ourError', errorType: 'attack' });
    const backRow: PointEvent = { ...lost, kind: 'ourError', playerId: 'p5' };
    expect(choose(backRow, 'block')).toEqual({ ...lost, kind: 'ourError', errorType: 'block' });
  });

  it('names nobody for other types, without a server, or when clearing', () => {
    expect(choose(lost, 'attack')).toEqual({ ...lost, kind: 'ourError', errorType: 'attack' });
    // Without a server (an older, implausible serve error) a player is dropped, none is named.
    expect(choose(lost, 'serve', null)).toEqual({ ...lost, kind: 'ourError', errorType: 'serve' });
    const typed: PointEvent = { ...lost, kind: 'ourError', errorType: 'serve', playerId: 'p4' };
    expect(choose(typed, null)).toEqual({ ...lost, kind: 'ourError', playerId: 'p4' });
  });

  it('leaves a set alone where the type cannot be set', () => {
    const won = withEvents([{ type: 'point', winner: 'us' }]);
    expect(chooseLastErrorType(won, 'serve', rally({ type: 'point', winner: 'us' }))).toBe(won);
  });
});
