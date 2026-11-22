import { emptySetLineup } from './lineup';
import { defaultStatsSeasonId } from './statsSeason';
import type { Season } from './types';

const season = (id: string): Season => ({
  id,
  teamId: 't1',
  name: id,
  kind: 'season',
  createdAt: '2026-01-01T00:00:00Z',
});

describe('defaultStatsSeasonId', () => {
  const played = {
    ...emptySetLineup(1),
    events: [{ type: 'point' as const, winner: 'us' as const }],
  };
  it('is the newest season with a played match, else null', () => {
    const list = [season('new'), season('mid'), season('old')];
    const matches = [
      { seasonId: 'new', sets: [emptySetLineup(1)] },
      { seasonId: 'old', sets: [played] },
      { seasonId: 'mid', sets: [played] },
    ];
    expect(defaultStatsSeasonId(list, matches)).toBe('mid');
    expect(defaultStatsSeasonId(list, matches.slice(0, 1))).toBeNull();
  });
});
