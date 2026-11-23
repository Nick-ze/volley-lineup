import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, PointEvent, Season } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '@/test-utils/presetsTeam';

const W: PointEvent = { type: 'point', winner: 'us' };
const L: PointEvent = { type: 'point', winner: 'them' };

const season = (id: string, name: string, startDate: string, over: Partial<Season> = {}) => ({
  id,
  teamId: 'team1',
  name,
  kind: 'season' as const,
  startDate,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});
const match = (id: string, seasonId: string, events: PointEvent[]): Match => ({
  id,
  teamId: 'team1',
  seasonId,
  opponentId: `opp-${id}`,
  opponent: id,
  date: '2026-11-01',
  home: true,
  sets: [{ setNumber: 1, ...fullLineup(), weServeFirst: true, events }],
});

/*
 * 2025/26: one match, 2 : 1 points. 2026/27: one match, 1 : 3 points, plus one not started.
 * Cup (tournament, newest by start date): no match played. All seasons: 3 : 4 points.
 */
function seed() {
  seedTeam();
  useAppStore.setState({
    seasons: [
      season('old', '2025/26', '2025-09-01'),
      season('new', '2026/27', '2026-09-01'),
      season('cup', 'Cup', '2026-12-01', { kind: 'tournament' }),
    ],
    matches: [
      match('mOld', 'old', [W, W, L]),
      match('mNew', 'new', [W, L, L, L]),
      match('mNext', 'new', []),
    ],
  });
}

afterEach(() => useAppStore.getState().setLanguage('en'));

const tab = (name: string) => screen.getByRole('tab', { name });
const points = (us: number, them: number) =>
  screen.getByLabelText(t.stats.season.pointsLabel(us, them));

describe('Stats tab season switcher (v7.0)', () => {
  it('opens on the newest season with a played match and filters by season', async () => {
    seed();
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByTestId('stats-tab')).toBeTruthy();
    // Newest first: All seasons · Cup · 2026/27 · 2025/26.
    expect(
      within(screen.getByLabelText(t.stats.seasonFilter.label))
        .getAllByRole('tab')
        .map((n) => n.props.accessibilityLabel),
    ).toEqual([
      t.stats.seasonFilter.allLabel,
      'Cup · Tournament',
      t.roster.seasonLabel('2026/27', 'Season'),
      t.roster.seasonLabel('2025/26', 'Season'),
    ]);
    expect(tab(t.roster.seasonLabel('2026/27', 'Season'))).toBeSelected();
    expect(points(1, 3)).toBeTruthy();
    expect(screen.getByText(t.stats.season.inProgress(1))).toBeTruthy();
    expect(screen.getByRole('header', { name: '2026/27' })).toBeTruthy();

    await fireEvent.press(tab(t.roster.seasonLabel('2025/26', 'Season')));
    expect(points(2, 1)).toBeTruthy();
    expect(screen.getByText(t.stats.season.inProgress(1))).toBeTruthy();

    await fireEvent.press(tab(t.stats.seasonFilter.allLabel));
    expect(points(3, 4)).toBeTruthy();
    // All seasons: a neutral heading, not "Season".
    expect(screen.getByRole('header', { name: t.stats.seasonFilter.all })).toBeTruthy();
    expect(screen.queryByRole('header', { name: t.stats.season.heading })).toBeNull();
    expect(screen.getByText(t.stats.season.inProgress(2))).toBeTruthy();

    await fireEvent.press(tab('Cup · Tournament'));
    expect(screen.getByText(t.stats.seasonFilter.empty)).toBeTruthy();
    expect(screen.queryByTestId('rotation-table')).toBeNull();
  });

  it('has no switcher with a single season', async () => {
    seed();
    useAppStore.setState({
      seasons: [season('new', '2026/27', '2026-09-01')],
      matches: [match('m', 'new', [W])],
    });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByTestId('stats-tab')).toBeTruthy();
    expect(screen.queryByRole('tab', { name: t.stats.seasonFilter.allLabel })).toBeNull();
    expect(points(1, 0)).toBeTruthy();
  });

  it('opens on All seasons when no season has a played match', async () => {
    seed();
    // A played match whose season is gone (cannot happen in the app) still counts in All seasons.
    useAppStore.setState({ matches: [match('m', 'gone', [W, L])] });
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByTestId('stats-tab')).toBeTruthy();
    expect(tab(t.stats.seasonFilter.allLabel)).toBeSelected();
    expect(points(1, 1)).toBeTruthy();
  });

  it('is translated into German', async () => {
    seed();
    useAppStore.getState().setLanguage('de');
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByRole('tab', { name: de.stats.seasonFilter.allLabel })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cup · Turnier' })).toBeTruthy();
  });
});
