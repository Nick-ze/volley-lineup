import { MAX_COLUMNS, MIN_COLUMNS, rosterCardWidth, rosterColumns } from './rosterGrid';

const GAP = 8;
// Content width = screen width (at most the 1100 px content width) minus 2 × 16 px padding.
const content = (screen: number) => Math.min(screen, 1100) - 32;

describe('rosterColumns', () => {
  it('shows 2 columns on a 375 px phone (and on narrower ones)', () => {
    expect(rosterColumns(content(375), GAP)).toBe(2);
    expect(rosterColumns(content(390), GAP)).toBe(2);
    expect(rosterColumns(content(320), GAP)).toBe(2);
  });

  it('shows 3 columns from about 600 px', () => {
    expect(rosterColumns(content(600), GAP)).toBe(3);
  });

  it('shows 4–5 columns on wide screens, at most 5', () => {
    expect(rosterColumns(content(800), GAP)).toBe(4);
    expect(rosterColumns(content(1280), GAP)).toBe(5);
    expect(rosterColumns(5000, GAP)).toBe(MAX_COLUMNS);
  });

  it('falls back to the minimum before the width is known', () => {
    expect(rosterColumns(0, GAP)).toBe(MIN_COLUMNS);
    expect(rosterColumns(-10, GAP)).toBe(MIN_COLUMNS);
    expect(rosterColumns(Number.NaN, GAP)).toBe(MIN_COLUMNS);
  });
});

describe('rosterCardWidth', () => {
  it('splits the width minus the gaps evenly', () => {
    expect(rosterCardWidth(343, 2, GAP)).toBe(167);
    expect(rosterCardWidth(1068, 5, GAP)).toBe(207);
  });

  it('never goes below 0', () => {
    expect(rosterCardWidth(4, 2, GAP)).toBe(0);
  });
});
