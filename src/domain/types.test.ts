import { ALL_POSITIONS, COURT_POSITIONS, SET_NUMBERS } from './types';

it('exposes the fixed value lists', () => {
  expect(COURT_POSITIONS).toEqual([1, 2, 3, 4, 5, 6]);
  expect(SET_NUMBERS).toEqual([1, 2, 3, 4, 5]);
  expect(ALL_POSITIONS).toEqual(['S', 'OH', 'MB', 'OPP', 'L', 'DS']);
});
