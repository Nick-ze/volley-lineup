import { dateMatches, matchFitsQuery, searchMatches } from './matchSearch';

const m = (opponent: string, date: string) => ({ opponent, date });
const matches = [
  m('TSV München', '2026-11-21'),
  m('SC Rivals', '2026-10-03'),
  m('Rivals II', '2025-11-21'),
];
const ids = (query: string) => searchMatches(matches, query).map((x) => `${x.opponent} ${x.date}`);

describe('match search (v6.2)', () => {
  it('an empty query keeps every match in order', () => {
    expect(ids('')).toHaveLength(3);
    expect(ids('   ')).toEqual(ids(''));
  });

  it('finds by opponent, ignoring case and accents, anywhere in the name', () => {
    expect(ids('munchen')).toEqual(['TSV München 2026-11-21']);
    expect(ids('RIVALS')).toEqual(['SC Rivals 2026-10-03', 'Rivals II 2025-11-21']);
    expect(ids('nobody')).toEqual([]);
  });

  it('finds by stored date parts', () => {
    expect(ids('2026-11')).toEqual(['TSV München 2026-11-21']);
    expect(ids('11-21')).toEqual(['TSV München 2026-11-21', 'Rivals II 2025-11-21']);
    expect(ids('2025')).toEqual(['Rivals II 2025-11-21']);
  });

  it('finds by German and US style dates', () => {
    expect(ids('21.11.')).toEqual(['TSV München 2026-11-21', 'Rivals II 2025-11-21']);
    expect(ids('21.11.2026')).toEqual(['TSV München 2026-11-21']);
    expect(ids('21.11.25')).toEqual(['Rivals II 2025-11-21']);
    expect(ids('3.10')).toEqual(['SC Rivals 2026-10-03']);
    expect(ids('11/21')).toEqual(['TSV München 2026-11-21', 'Rivals II 2025-11-21']);
    expect(ids('10/3/2026')).toEqual(['SC Rivals 2026-10-03']);
    expect(ids('22.11.')).toEqual([]);
    expect(dateMatches('2026-11-21', '21.11.2024')).toBe(false);
    expect(dateMatches('2026-11-21', '11/22')).toBe(false);
  });

  it('every word must match the name or the date', () => {
    expect(ids('rivals 2026')).toEqual(['SC Rivals 2026-10-03']);
    expect(matchFitsQuery(m('Rivals', '2026-01-02'), 'rivals 2.1.')).toBe(true);
    expect(matchFitsQuery(m('Rivals', '2026-01-02'), 'rivals 3.1.')).toBe(false);
  });

  it('copes with a malformed stored date', () => {
    expect(dateMatches('', '21.11.')).toBe(false);
    expect(dateMatches('', '11/21')).toBe(false);
  });
});
