import { act, render, screen } from '@testing-library/react-native';

import { emptySetLineup } from '@/domain/lineup';
import * as stats from '@/domain/stats';
import type { Match } from '@/domain/types';
import { useAppStore } from '@/store';

import { SeasonsTab } from '../SeasonsTab';

/* v8.3 (AUDIT A2): each season box gets the same matches array while its matches are unchanged,
 * so its overview isn't recomputed when a match of another season changes (e.g. a point scored
 * in a match while the team screen is under the live screen). */

jest.mock('@/domain/stats', () => {
  const actual = jest.requireActual('@/domain/stats');
  return { ...actual, seasonOverview: jest.fn(actual.seasonOverview) };
});
const seasonOverview = stats.seasonOverview as jest.Mock;

const store = () => useAppStore.getState();

function seed() {
  store().resetAll();
  useAppStore.setState({ hydrated: true });
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  const add = (name: string, date: string) => {
    const season = store().addSeason({ teamId: team.id, name, kind: 'season' });
    const opp = store().addOpponent(season.id, 'Lions');
    const match = store().addMatch({
      teamId: team.id,
      seasonId: season.id,
      opponentId: opp.id,
      opponent: opp.name,
      date,
      home: true,
      sets: [emptySetLineup(1)],
    });
    return { season, match };
  };
  return { team, a: add('Season A', '2026-01-01'), b: add('Season B', '2026-02-01') };
}

const overviewsOf = (seasonId: string) =>
  seasonOverview.mock.calls.filter(([matches]: [Match[]]) =>
    matches.every((m) => m.seasonId === seasonId),
  ).length;

it('recomputes only the box of the season whose match changed', async () => {
  const { team, a, b } = seed();
  await render(<SeasonsTab teamId={team.id} onNewSeason={jest.fn()} onOpenSeason={jest.fn()} />);
  expect(screen.getByText('Season A')).toBeTruthy();
  seasonOverview.mockClear();
  await act(async () => {
    store().updateMatch(a.match.id, { opponent: 'Tigers' });
  });
  expect(overviewsOf(a.season.id)).toBe(1);
  expect(overviewsOf(b.season.id)).toBe(0);
});
