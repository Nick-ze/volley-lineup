/**
 * v12 PR 5: every hosted-tournament screen has its own tour tips (full tour: shown; quick tour:
 * offered once).
 */
import { fireEvent, screen } from '@testing-library/react-native';

import type { TourPage } from '@/domain/types';
import { t } from '@/i18n/en';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useAppStore } from '@/store';
import { renderApp, resetStores } from '@/test-utils';

const tips = t.tour.steps;
const store = () => useAppStore.getState();

beforeEach(() => {
  resetStores();
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
});

function seed() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
  });
  const a = store().addHostedTeam(cup.id, 'TV Nord');
  const b = store().addHostedTeam(cup.id, 'Rivals');
  return { cup, a, b };
}

const fullTour = () => useAppStore.setState({ tourMode: 'full', tourSeen: [] });

describe('tour tips on the tournament screens', () => {
  it.each<[TourPage, (ids: ReturnType<typeof seed>) => string, string]>([
    ['tournaments', () => '/tournaments', tips.tournaments.create.title],
    ['tournamentForm', () => '/tournament-new', tips.tournamentForm.format.title],
    [
      'tournamentTable',
      (x) => `/tournament/${x.cup.id}?tab=table`,
      tips.tournamentTable.table.title,
    ],
    [
      'tournamentMatches',
      (x) => `/tournament/${x.cup.id}?tab=matches`,
      tips.tournamentMatches.result.title,
    ],
    ['tournamentTeams', (x) => `/tournament/${x.cup.id}?tab=teams`, tips.tournamentTeams.add.title],
    [
      'tournamentTeam',
      (x) => `/tournament/${x.cup.id}/team/${x.a.id}`,
      tips.tournamentTeam.matches.title,
    ],
    [
      'tournamentResult',
      (x) => `/tournament/${x.cup.id}/match?a=${x.a.id}&b=${x.b.id}`,
      tips.tournamentResult.sets.title,
    ],
  ])('full tour: %s shows its tips once', async (page, url, title) => {
    const ids = seed();
    fullTour();
    await renderApp(url(ids));
    expect(await screen.findByText(title)).toBeTruthy();
    // Walk through the page's tips; then it counts as seen.
    while (screen.queryByTestId('tour-next'))
      await fireEvent.press(screen.getByTestId('tour-next'));
    await fireEvent.press(screen.getByTestId('tour-done'));
    expect(store().tourSeen).toContain(page);
    expect(screen.queryByText(title)).toBeNull();
  });

  it('the tournament screen shows the tips of the tab it is on', async () => {
    const { cup } = seed();
    fullTour();
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    expect(await screen.findByText(tips.tournamentTeams.add.title)).toBeTruthy();
    expect(screen.queryByText(tips.tournamentMatches.result.title)).toBeNull();
    expect(screen.queryByText(tips.tournamentTable.table.title)).toBeNull();
  });

  it('no tips on "not found"', async () => {
    seed();
    fullTour();
    await renderApp('/tournament/nope');
    expect(screen.getByText(t.tournament.form.notFound)).toBeTruthy();
    expect(screen.queryByTestId('tour-done')).toBeNull();
    expect(screen.queryByTestId('tour-next')).toBeNull();
    expect(store().tourSeen).toEqual([]);
  });

  it('quick tour: the Tournaments tab only offers its tips', async () => {
    seed();
    useAppStore.setState({ tourMode: 'quick', tourSeen: [] });
    await renderApp('/tournaments');
    expect(await screen.findByText(t.tour.offer.title(t.tour.pages.tournaments))).toBeTruthy();
    expect(screen.queryByText(tips.tournaments.create.title)).toBeNull();
  });
});
