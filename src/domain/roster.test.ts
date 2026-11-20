import {
  isJerseyNumberTaken,
  isValidIsoDate,
  makePrimaryPosition,
  NAME_MAX_LENGTH,
  SEASON_MAX_LENGTH,
  toIsoDate,
  togglePosition,
  validateMatchForm,
  validatePlayerForm,
  validateProfileForm,
  validateTeamForm,
  type PlayerFormInput,
} from './roster';
import type { Player } from './types';

const player = (id: string, number: number, teamId = 't1'): Player => ({
  id,
  teamId,
  firstName: 'A',
  lastName: 'B',
  number,
  positions: ['OH'],
  active: true,
});

const players = [player('p1', 7), player('p2', 3), player('p3', 9, 't2')];

describe('isJerseyNumberTaken', () => {
  it('detects a number used in the same team', () => {
    expect(isJerseyNumberTaken(players, 't1', 7)).toBe(true);
  });
  it('ignores other teams and the player being edited', () => {
    expect(isJerseyNumberTaken(players, 't1', 9)).toBe(false);
    expect(isJerseyNumberTaken(players, 't1', 7, 'p1')).toBe(false);
    expect(isJerseyNumberTaken(players, 't1', 7, 'p2')).toBe(true);
  });
});

describe('positions', () => {
  it('toggles positions, keeping the first as primary', () => {
    expect(togglePosition([], 'S')).toEqual(['S']);
    expect(togglePosition(['S'], 'OH')).toEqual(['S', 'OH']);
    expect(togglePosition(['S', 'OH'], 'S')).toEqual(['OH']);
  });
  it('makes a position primary', () => {
    expect(makePrimaryPosition(['S', 'OH', 'MB'], 'MB')).toEqual(['MB', 'S', 'OH']);
    expect(makePrimaryPosition(['S'], 'L')).toEqual(['L', 'S']);
  });
});

describe('dates', () => {
  it('formats a local date', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 10, 20))).toBe('2026-11-20');
  });
  it('validates ISO calendar dates', () => {
    expect(isValidIsoDate('2026-11-20')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-1-01')).toBe(false);
    expect(isValidIsoDate('20.11.2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('validateProfileForm', () => {
  it('trims and accepts a valid profile', () => {
    expect(validateProfileForm({ name: '  Coach ', color: '#fff' })).toEqual({
      ok: true,
      value: { name: 'Coach', color: '#fff' },
      errors: {},
    });
  });
  it('rejects empty, too long and colourless profiles', () => {
    expect(validateProfileForm({ name: '   ', color: '' }).errors).toEqual({
      name: 'required',
      color: 'required',
    });
    expect(
      validateProfileForm({ name: 'x'.repeat(NAME_MAX_LENGTH + 1), color: '#f' }).errors,
    ).toEqual({ name: 'tooLong' });
  });
});

describe('validateTeamForm', () => {
  it('accepts a team with and without a season', () => {
    const r = validateTeamForm({ name: ' Herren 1 ', season: ' 2026/27 ' });
    expect(r.ok && r.value).toEqual({ name: 'Herren 1', season: '2026/27' });
    const r2 = validateTeamForm({ name: 'Damen', season: '  ' });
    expect(r2.ok && r2.value).toEqual({ name: 'Damen', season: undefined });
  });
  it('rejects missing name and long season', () => {
    expect(
      validateTeamForm({ name: '', season: 'x'.repeat(SEASON_MAX_LENGTH + 1) }).errors,
    ).toEqual({ name: 'required', season: 'tooLong' });
  });
});

describe('validatePlayerForm', () => {
  const base: PlayerFormInput = {
    firstName: ' Ana ',
    lastName: ' Ace',
    number: ' 12 ',
    positions: ['S', 'OH'],
    active: true,
  };
  const ctx = { players, teamId: 't1' };

  it('accepts and normalises a valid player', () => {
    const r = validatePlayerForm(base, ctx);
    expect(r).toEqual({
      ok: true,
      value: {
        firstName: 'Ana',
        lastName: 'Ace',
        number: 12,
        positions: ['S', 'OH'],
        active: true,
      },
      errors: {},
    });
  });

  it('accepts 0 and 99', () => {
    expect(validatePlayerForm({ ...base, number: '0' }, ctx).ok).toBe(true);
    expect(validatePlayerForm({ ...base, number: '99' }, ctx).ok).toBe(true);
  });

  it('requires names, number and a position', () => {
    const r = validatePlayerForm(
      { firstName: ' ', lastName: '', number: '', positions: [], active: false },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual({
      firstName: 'required',
      lastName: 'required',
      number: 'required',
      positions: 'required',
    });
  });

  it('rejects non-integer and out-of-range numbers', () => {
    expect(validatePlayerForm({ ...base, number: '7.5' }, ctx).errors).toEqual({
      number: 'notInteger',
    });
    expect(validatePlayerForm({ ...base, number: 'abc' }, ctx).errors).toEqual({
      number: 'notInteger',
    });
    expect(validatePlayerForm({ ...base, number: '100' }, ctx).errors).toEqual({
      number: 'outOfRange',
    });
    expect(validatePlayerForm({ ...base, number: '-1' }, ctx).errors).toEqual({
      number: 'outOfRange',
    });
  });

  it('rejects a jersey number already taken in the team, except by the edited player', () => {
    expect(validatePlayerForm({ ...base, number: '7' }, ctx).errors).toEqual({ number: 'taken' });
    expect(validatePlayerForm({ ...base, number: '7' }, { ...ctx, playerId: 'p1' }).ok).toBe(true);
    expect(validatePlayerForm({ ...base, number: '9' }, ctx).ok).toBe(true);
  });

  it('rejects duplicate positions and too-long names', () => {
    expect(
      validatePlayerForm(
        { ...base, positions: ['S', 'S'], lastName: 'x'.repeat(NAME_MAX_LENGTH + 1) },
        ctx,
      ).errors,
    ).toEqual({ positions: 'duplicate', lastName: 'tooLong' });
  });
});

describe('validateMatchForm', () => {
  it('accepts a valid match', () => {
    expect(validateMatchForm({ opponent: ' Rivals ', date: '2026-11-20', home: false })).toEqual({
      ok: true,
      value: { opponent: 'Rivals', date: '2026-11-20', home: false },
      errors: {},
    });
  });
  it('rejects missing opponent and invalid date', () => {
    expect(validateMatchForm({ opponent: '', date: '2026-02-30', home: true }).errors).toEqual({
      opponent: 'required',
      date: 'invalidDate',
    });
  });
});
