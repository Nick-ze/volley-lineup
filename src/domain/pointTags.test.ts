import { emptySetLineup } from './lineup';
import {
  isValidPointTag,
  kindTakesErrorType,
  kindTakesPlayer,
  setLastErrorType,
  pointKindsFor,
  tagLastPoint,
  THEM_POINT_KINDS,
  US_POINT_KINDS,
} from './pointTags';
import { ERROR_TYPES, type ErrorType, type SetLineup } from './types';

const withEvents = (events: SetLineup['events']): SetLineup => ({ ...emptySetLineup(1), events });

describe('point kinds', () => {
  it('offers our tags after a point for us and theirs after a point for them', () => {
    expect(pointKindsFor('us')).toEqual(['kill', 'ace', 'block', 'opponentError']);
    expect(pointKindsFor('them')).toEqual(['ourError', 'opponentKill', 'opponentAce']);
    expect(pointKindsFor('us')).toBe(US_POINT_KINDS);
    expect(pointKindsFor('them')).toBe(THEM_POINT_KINDS);
  });

  it('only kill, ace, block and our error name a player', () => {
    expect(US_POINT_KINDS.filter(kindTakesPlayer)).toEqual(['kill', 'ace', 'block']);
    expect(THEM_POINT_KINDS.filter(kindTakesPlayer)).toEqual(['ourError']);
  });
});

describe('isValidPointTag', () => {
  it.each([
    [{ winner: 'us' as const }, true],
    [{ winner: 'us' as const, kind: 'kill' as const, playerId: 'p' }, true],
    [{ winner: 'us' as const, kind: 'opponentError' as const }, true],
    [{ winner: 'them' as const, kind: 'ourError' as const }, true],
    [{ winner: 'them' as const, kind: 'ourError' as const, playerId: 'p' }, true],
    [{ winner: 'us' as const, playerId: 'p' }, false],
    [{ winner: 'us' as const, kind: 'opponentAce' as const }, false],
    [{ winner: 'them' as const, kind: 'ace' as const }, false],
    [{ winner: 'us' as const, kind: 'opponentError' as const, playerId: 'p' }, false],
  ])('%p → %p', (event, valid) => {
    expect(isValidPointTag(event)).toBe(valid);
  });
});

describe('tagLastPoint', () => {
  const at = '2026-11-21T10:00:00.000Z';
  const played = withEvents([
    { type: 'point', winner: 'them' },
    { type: 'point', winner: 'us', at },
  ]);

  it('tags the last point, keeping winner and timestamp', () => {
    expect(tagLastPoint(played, 'kill', 'p1').events[1]).toEqual({
      type: 'point',
      winner: 'us',
      at,
      kind: 'kill',
      playerId: 'p1',
    });
    expect(tagLastPoint(played, 'opponentError').events[1]).toEqual({
      type: 'point',
      winner: 'us',
      at,
      kind: 'opponentError',
    });
    expect(tagLastPoint(played, 'kill').events[0]).toBe(played.events[0]);
  });

  it('replaces or clears an existing tag', () => {
    const tagged = tagLastPoint(played, 'kill', 'p1');
    expect(tagLastPoint(tagged, 'ace').events[1]).toEqual({
      type: 'point',
      winner: 'us',
      at,
      kind: 'ace',
    });
    expect(tagLastPoint(tagged, null).events[1]).toEqual({ type: 'point', winner: 'us', at });
  });

  it('leaves the set unchanged for an invalid tag or when there is no point to tag', () => {
    expect(tagLastPoint(played, 'ourError')).toBe(played);
    expect(tagLastPoint(played, 'opponentError', 'p1')).toBe(played);
    const empty = withEvents([]);
    expect(tagLastPoint(empty, 'kill')).toBe(empty);
    const afterSub = withEvents([
      { type: 'point', winner: 'us' },
      { type: 'sub', outPlayerId: 'a', inPlayerId: 'b' },
    ]);
    expect(tagLastPoint(afterSub, 'kill')).toBe(afterSub);
  });
});

describe('v7 error types', () => {
  const at = '2026-11-21T10:00:00.000Z';
  const lost = withEvents([{ type: 'point', winner: 'them', at }]);

  it('only "our error" carries an error type, and only a known one', () => {
    expect(kindTakesErrorType('ourError')).toBe(true);
    expect(kindTakesErrorType('opponentKill')).toBe(false);
    expect(isValidPointTag({ winner: 'them', kind: 'ourError', errorType: 'serve' })).toBe(true);
    expect(
      isValidPointTag({ winner: 'them', kind: 'ourError', playerId: 'p', errorType: 'netFault' }),
    ).toBe(true);
    expect(isValidPointTag({ winner: 'them', errorType: 'serve' })).toBe(false);
    expect(isValidPointTag({ winner: 'them', kind: 'opponentKill', errorType: 'serve' })).toBe(
      false,
    );
    expect(
      isValidPointTag({
        winner: 'them',
        kind: 'ourError',
        errorType: 'dig' as unknown as ErrorType,
      }),
    ).toBe(false);
  });

  it('lists the seven error types in display order', () => {
    expect(ERROR_TYPES).toEqual([
      'serve',
      'reception',
      'attack',
      'block',
      'set',
      'netFault',
      'other',
    ]);
  });

  it('sets, changes and clears the error type of the last lost rally', () => {
    const typed = setLastErrorType(lost, 'reception');
    expect(typed.events[0]).toEqual({
      type: 'point',
      winner: 'them',
      at,
      kind: 'ourError',
      errorType: 'reception',
    });
    expect(setLastErrorType(typed, 'attack').events[0]).toMatchObject({ errorType: 'attack' });
    expect(setLastErrorType(typed, null).events[0]).toEqual({
      type: 'point',
      winner: 'them',
      at,
      kind: 'ourError',
    });
  });

  it('keeps the error type when the player is picked, drops it for another kind', () => {
    const typed = setLastErrorType(lost, 'serve');
    expect(tagLastPoint(typed, 'ourError', 'p1').events[0]).toEqual({
      type: 'point',
      winner: 'them',
      at,
      kind: 'ourError',
      playerId: 'p1',
      errorType: 'serve',
    });
    expect(tagLastPoint(typed, 'opponentKill').events[0]).toEqual({
      type: 'point',
      winner: 'them',
      at,
      kind: 'opponentKill',
    });
    expect(tagLastPoint(typed, null).events[0]).toEqual({ type: 'point', winner: 'them', at });
  });

  it('leaves other last events alone', () => {
    const won = withEvents([{ type: 'point', winner: 'us' }]);
    expect(setLastErrorType(won, 'serve')).toBe(won);
    const theirKill = withEvents([{ type: 'point', winner: 'them', kind: 'opponentKill' }]);
    expect(setLastErrorType(theirKill, 'serve')).toBe(theirKill);
    const sub = withEvents([{ type: 'sub', outPlayerId: 'a', inPlayerId: 'b' }]);
    expect(setLastErrorType(sub, 'serve')).toBe(sub);
    expect(setLastErrorType(withEvents([]), 'serve').events).toEqual([]);
    expect(setLastErrorType(lost, 'bogus' as unknown as ErrorType)).toBe(lost);
  });
});
