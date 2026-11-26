import {
  duplicateNumbers,
  isJerseyNumberTaken,
  makePrimaryPosition,
  NAME_MAX_LENGTH,
  SEASON_MAX_LENGTH,
  teamsWithDuplicateNumbers,
  togglePosition,
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

describe('duplicateNumbers (audit H6)', () => {
  const withNumbers = (...numbers: number[]) => numbers.map((n, i) => player(`p${i}`, n));

  it('is empty when every number is used once, and for no players', () => {
    expect(duplicateNumbers(withNumbers(7, 3, 12))).toEqual([]);
    expect(duplicateNumbers([])).toEqual([]);
  });
  it('lists a number that two players share', () => {
    expect(duplicateNumbers(withNumbers(7, 3, 7))).toEqual([7]);
  });
  it('lists every shared number once, ascending (also when three players share it)', () => {
    expect(duplicateNumbers(withNumbers(12, 7, 0, 12, 7, 12, 3, 0))).toEqual([0, 7, 12]);
  });
  it('does not change the given list', () => {
    const list = withNumbers(9, 2, 9);
    duplicateNumbers(list);
    expect(list.map((p) => p.number)).toEqual([9, 2, 9]);
  });
});

describe('teamsWithDuplicateNumbers (audit H6)', () => {
  const teams = [
    { id: 't2', name: 'Damen' },
    { id: 't1', name: 'Herren 1' },
    { id: 't3', name: 'Mixed' },
  ];

  it('is empty when no team has a number twice (the same number in two teams is fine)', () => {
    expect(teamsWithDuplicateNumbers(teams, [player('a', 7), player('b', 7, 't2')])).toEqual([]);
    expect(teamsWithDuplicateNumbers(teams, [])).toEqual([]);
    expect(teamsWithDuplicateNumbers([], [player('a', 7), player('b', 7)])).toEqual([]);
  });
  it('lists each team with shared numbers, in the order of the teams', () => {
    const all = [
      player('a', 12),
      player('b', 7),
      player('c', 12),
      player('d', 7),
      player('e', 3, 't2'),
      player('f', 3, 't2'),
      player('g', 5, 't2'),
      player('h', 5, 't3'),
    ];
    expect(teamsWithDuplicateNumbers(teams, all)).toEqual([
      { name: 'Damen', numbers: [3] },
      { name: 'Herren 1', numbers: [7, 12] },
    ]);
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
  it('counts characters, not UTF-16 units (as zod did before v8.3)', () => {
    const emoji = '😀'; // two UTF-16 units
    expect(validateProfileForm({ name: emoji.repeat(NAME_MAX_LENGTH), color: '#f' }).ok).toBe(true);
    expect(
      validateProfileForm({ name: emoji.repeat(NAME_MAX_LENGTH + 1), color: '#f' }).errors,
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
