import { parseSeasonTab } from '../seasonTabs';

describe('parseSeasonTab', () => {
  it('parses the season screen tabs (match list by default)', () => {
    expect(parseSeasonTab('opponents')).toBe('opponents');
    expect(parseSeasonTab(['stats'])).toBe('stats');
    expect(parseSeasonTab('roster')).toBe('matches');
    expect(parseSeasonTab(undefined)).toBe('matches');
  });
});
