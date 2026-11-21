import { chooseLastErrorType } from './errorTagging';
import { emptySetLineup } from './lineup';
import type { SetLineup } from './types';

const withEvents = (events: SetLineup['events']): SetLineup => ({ ...emptySetLineup(1), events });
const last = (set: SetLineup) => set.events[set.events.length - 1];

describe('chooseLastErrorType', () => {
  it('names our server for a serve error when no player is tagged', () => {
    const set = withEvents([{ type: 'point', winner: 'them' }]);
    expect(last(chooseLastErrorType(set, 'serve', 'p2'))).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'serve',
      playerId: 'p2',
    });
  });

  it('keeps an already tagged player', () => {
    const set = withEvents([{ type: 'point', winner: 'them', kind: 'ourError', playerId: 'p5' }]);
    expect(last(chooseLastErrorType(set, 'serve', 'p2'))).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'serve',
      playerId: 'p5',
    });
  });

  it('names nobody for other types, without a server, or when clearing', () => {
    const set = withEvents([{ type: 'point', winner: 'them' }]);
    expect(last(chooseLastErrorType(set, 'attack', 'p2'))).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'attack',
    });
    expect(last(chooseLastErrorType(set, 'serve', null))).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'serve',
    });
    const typed = withEvents([
      { type: 'point', winner: 'them', kind: 'ourError', errorType: 'serve' },
    ]);
    expect(last(chooseLastErrorType(typed, null, 'p2'))).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
    });
  });

  it('leaves a set alone where the type cannot be set', () => {
    const won = withEvents([{ type: 'point', winner: 'us' }]);
    expect(chooseLastErrorType(won, 'serve', 'p2')).toBe(won);
    const empty = withEvents([]);
    expect(chooseLastErrorType(empty, 'serve', 'p2')).toBe(empty);
    const sub = withEvents([{ type: 'sub', outPlayerId: 'p1', inPlayerId: 'p8' }]);
    expect(chooseLastErrorType(sub, 'serve', 'p2')).toBe(sub);
  });
});
