import { teamAvatarColor, teamInitial } from './teamAvatar';

describe('teamInitial', () => {
  it('is the first letter in upper case', () => {
    expect(teamInitial('herren 1')).toBe('H');
    expect(teamInitial('  Damen ')).toBe('D');
  });

  it('keeps accents', () => {
    expect(teamInitial('élan')).toBe('É');
    expect(teamInitial('Übersee')).toBe('Ü');
  });

  it('keeps an emoji whole', () => {
    expect(teamInitial('🏐 Club')).toBe('🏐');
  });

  it('is "?" for an empty name', () => {
    expect(teamInitial('')).toBe('?');
    expect(teamInitial('   ')).toBe('?');
  });
});

describe('teamAvatarColor', () => {
  const palette = ['#A', '#B', '#C', '#D', '#E', '#F', '#G'];

  it('is always the same for the same key', () => {
    expect(teamAvatarColor('team-1', palette)).toBe(teamAvatarColor('team-1', palette));
  });

  it('is one of the palette colours and spreads over it', () => {
    const picked = new Set(
      Array.from({ length: 50 }, (_, i) => teamAvatarColor(`team-${i}`, palette)),
    );
    for (const c of picked) expect(palette).toContain(c);
    expect(picked.size).toBeGreaterThan(3);
  });

  it('works for empty and non-ASCII keys', () => {
    expect(palette).toContain(teamAvatarColor('', palette));
    expect(palette).toContain(teamAvatarColor('Zürich 🏐', palette));
  });

  it('rejects an empty palette', () => {
    expect(() => teamAvatarColor('x', [])).toThrow();
  });
});
