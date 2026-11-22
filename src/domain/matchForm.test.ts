import { matchingOpponent, validateNewMatch, type NewMatchInput } from './matchForm';
import type { Opponent, Season } from './types';

const season = (id: string, teamId = 't1'): Season => ({
  id,
  teamId,
  name: id,
  kind: 'season',
  createdAt: '2026-01-01T00:00:00Z',
});
const opponent = (id: string, name: string, seasonId = 's1'): Opponent => ({
  id,
  seasonId,
  name,
  createdAt: '2026-01-01',
});

const seasons = [season('s1'), season('s2'), season('other', 't2')];
const opponents = [opponent('o1', 'TSV München'), opponent('o2', 'Rivals', 's2')];
const ctx = { teamId: 't1', seasons, opponents };
const input = (over: Partial<NewMatchInput> = {}): NewMatchInput => ({
  seasonId: 's1',
  newSeasonName: '',
  opponentId: null,
  opponentName: '',
  date: '2026-11-21',
  home: true,
  ...over,
});

describe('validateNewMatch', () => {
  it('takes an opponent chip of the season', () => {
    expect(validateNewMatch(input({ opponentId: 'o1', home: false }), ctx)).toEqual({
      ok: true,
      errors: {},
      value: {
        season: { kind: 'existing', id: 's1' },
        opponent: { kind: 'existing', id: 'o1' },
        date: '2026-11-21',
        home: false,
      },
    });
  });

  it('uses the existing opponent for a typed name in other case / accents', () => {
    const result = validateNewMatch(input({ opponentName: '  tsv  munchen ' }), ctx);
    expect(result.ok && result.value.opponent).toEqual({ kind: 'existing', id: 'o1' });
  });

  it('a typed name wins over the chip; a new name is trimmed', () => {
    const result = validateNewMatch(input({ opponentId: 'o1', opponentName: ' Lions ' }), ctx);
    expect(result.ok && result.value.opponent).toEqual({ kind: 'new', name: 'Lions' });
  });

  it("does not match another season's opponent", () => {
    const result = validateNewMatch(input({ opponentName: 'rivals' }), ctx);
    expect(result.ok && result.value.opponent).toEqual({ kind: 'new', name: 'rivals' });
    expect(validateNewMatch(input({ opponentId: 'o2' }), ctx).errors).toEqual({
      opponent: 'required',
    });
  });

  it('requires an opponent and a valid date', () => {
    expect(validateNewMatch(input({ opponentName: '   ', date: '2026-02-30' }), ctx)).toEqual({
      ok: false,
      errors: { opponent: 'required', date: 'invalidDate' },
    });
    expect(validateNewMatch(input({ opponentName: 'x'.repeat(61) }), ctx).errors).toEqual({
      opponent: 'tooLong',
    });
  });

  it('requires one of the team’s seasons when it has any', () => {
    expect(validateNewMatch(input({ seasonId: 'other', opponentName: 'A' }), ctx).errors).toEqual({
      season: 'required',
    });
  });

  it('names a new season when the team has none', () => {
    const none = { teamId: 't3', seasons, opponents };
    const ok = validateNewMatch(
      input({ seasonId: null, newSeasonName: ' 2026 ', opponentName: 'A' }),
      none,
    );
    expect(ok.ok && ok.value.season).toEqual({ kind: 'new', name: '2026' });
    expect(ok.ok && ok.value.opponent).toEqual({ kind: 'new', name: 'A' });
    expect(validateNewMatch(input({ seasonId: null, opponentName: 'A' }), none).errors).toEqual({
      season: 'required',
    });
    expect(
      validateNewMatch(
        input({ seasonId: null, newSeasonName: 'y'.repeat(41), opponentName: 'A' }),
        none,
      ).errors,
    ).toEqual({ season: 'tooLong' });
  });
});

describe('matchingOpponent', () => {
  it('finds the season opponent by folded name; nothing for blank names or no season', () => {
    expect(matchingOpponent(opponents, 's1', 'TSV MÜNCHEN')?.id).toBe('o1');
    expect(matchingOpponent(opponents, 's1', '  ')).toBeUndefined();
    expect(matchingOpponent(opponents, null, 'TSV München')).toBeUndefined();
  });
});
