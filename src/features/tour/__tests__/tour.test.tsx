import { act, fireEvent, screen } from '@testing-library/react-native';

import { TOUR_PAGES } from '@/domain/tour';
import type { TourMode, TourPage } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { includeHidden, makePlayer, makeSet, renderApp, resetStores, seedApp } from '@/test-utils';

import { tourSteps } from '../steps';
import { resetTourSession, useTourSession } from '../tourSession';

const tips = t.tour.steps;
const players = [
  makePlayer(1, 'Sina', ['S']),
  makePlayer(2, 'Olga', ['OH']),
  makePlayer(3, 'Mara', ['MB']),
  makePlayer(4, 'Opal', ['OPP']),
  makePlayer(5, 'Ola', ['OH']),
  makePlayer(6, 'Mia', ['MB']),
  makePlayer(7, 'Lea', ['L']),
];
const match = { id: 'm1', opponent: 'Lions', date: '2026-11-20', home: true, sets: [makeSet()] };

/** The team with players and a match, and the tour set to `mode` with `seen` pages. */
function seed(mode: TourMode | null, seen: TourPage[] = []) {
  seedApp({ players, matches: [match] });
  useAppStore.setState({ tourMode: mode, tourSeen: seen });
}

const popup = () => screen.queryByTestId('tour-popup');
const offer = () => screen.queryByTestId('tour-offer');
const seen = () => useAppStore.getState().tourSeen;
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

beforeEach(() => resetTourSession());

describe('first start', () => {
  it('asks which tour to show; Quick tour starts with the profile tips', async () => {
    resetStores();
    useAppStore.setState({ tourMode: null, tourSeen: [] });
    await renderApp('/');
    expect(await screen.findByTestId('tour-choice')).toBeTruthy();
    expect(screen.getByText(t.tour.choice.title)).toBeTruthy();
    // First start: three options, no Cancel.
    expect(screen.getByText(t.tour.choice.full)).toBeTruthy();
    expect(screen.getByText(t.tour.choice.none)).toBeTruthy();
    expect(screen.queryByTestId('tour-choice-cancel')).toBeNull();

    await press('tour-choose-quick');
    expect(useAppStore.getState().tourMode).toBe('quick');
    expect(screen.queryByTestId('tour-choice')).toBeNull();
    // The focused screen's tips right away, with the visual guide.
    expect(popup()).toBeTruthy();
    expect(screen.getByText(tips.profiles.create.title)).toBeTruthy();
    expect(screen.getByTestId('tour-visual-form', includeHidden)).toBeTruthy();
    expect(screen.getByLabelText(t.tour.popup.stepOf(1, 2))).toBeTruthy();
    expect(screen.queryByTestId('tour-back')).toBeNull();

    await press('tour-next');
    expect(screen.getByText(tips.profiles.open.title)).toBeTruthy();
    expect(screen.getByLabelText(t.tour.popup.stepOf(2, 2))).toBeTruthy();
    await press('tour-back');
    expect(screen.getByText(tips.profiles.create.title)).toBeTruthy();
    await press('tour-next');
    await press('tour-done');
    expect(popup()).toBeNull();
    expect(seen()).toEqual(['profiles']);
  });

  it('No tour: no tips anywhere', async () => {
    resetStores();
    useAppStore.setState({ tourMode: null, tourSeen: [] });
    await renderApp('/');
    await press('tour-choose-none');
    expect(useAppStore.getState().tourMode).toBe('none');
    expect(screen.queryByTestId('tour-choice')).toBeNull();
    expect(popup()).toBeNull();
  });
});

describe('full tour', () => {
  it('shows a page’s tips once and marks the page seen', async () => {
    seed('full');
    await renderApp('/team/team1?tab=roster');
    expect(await screen.findByTestId('tour-popup')).toBeTruthy();
    expect(screen.getByText(tips.roster.add.title)).toBeTruthy();
    await press('tour-next');
    expect(screen.getByTestId('tour-visual-swipe', includeHidden)).toBeTruthy();
    await press('tour-done');
    expect(popup()).toBeNull();
    expect(seen()).toEqual(['roster']);
    // Opened again: nothing.
    resetTourSession();
    await renderApp('/team/team1?tab=roster');
    await screen.findByTestId('team-nav');
    expect(popup()).toBeNull();
  });

  it('only the shown tab counts: pager neighbours never trigger tips', async () => {
    seed('full');
    await renderApp('/team/team1?tab=roster');
    await screen.findByTestId('tour-popup');
    // The neighbour (Matches) is mounted beside the roster but has no say.
    expect(useTourSession.getState().popup?.page).toBe('roster');
    expect(useTourSession.getState().focused).toBe('roster');
    await press('tour-next');
    await press('tour-done');
    expect(seen()).toEqual(['roster']);
    expect(popup()).toBeNull();
    // Switching to the Matches tab shows its tips.
    await fireEvent.press(screen.getByRole('tab', { name: t.presets.nav.matches }));
    expect(useTourSession.getState().focused).toBe('matches');
    expect(screen.getByText(tips.matches.season.title)).toBeTruthy();
  });

  it('a screen under another one stays quiet; the screen on top shows its tips', async () => {
    seed('full', ['roster']);
    await renderApp('/team/team1?tab=roster');
    await screen.findByTestId('team-nav');
    expect(popup()).toBeNull();
    await fireEvent.press(screen.getByText(t.roster.roster.addPlayer));
    expect(useTourSession.getState().focused).toBe('playerForm');
    expect(screen.getByText(tips.playerForm.name.title)).toBeTruthy();
    expect(screen.getByTestId('tour-visual-form', includeHidden)).toBeTruthy();
  });

  it('live: the shown view’s tips, Live first', async () => {
    seed('full');
    await renderApp('/match/m1/live');
    expect(await screen.findByTestId('tour-popup')).toBeTruthy();
    expect(screen.getByText(tips.live.score.title)).toBeTruthy();
    expect(screen.getByTestId('tour-visual-score', includeHidden)).toBeTruthy();
    expect(useTourSession.getState().popup?.page).toBe('live');
  });

  it('End tour: no more tips (tour mode none)', async () => {
    seed('full');
    await renderApp('/match/m1');
    expect(await screen.findByTestId('tour-popup')).toBeTruthy();
    expect(screen.getByTestId('tour-visual-drag', includeHidden)).toBeTruthy();
    // Full tour: no "that's the quick tour" note.
    await press('tour-next');
    await press('tour-next');
    expect(screen.queryByTestId('tour-quick-done')).toBeNull();
    await press('tour-end');
    expect(useAppStore.getState().tourMode).toBe('none');
    expect(popup()).toBeNull();
    resetTourSession();
    await renderApp('/team/team1?tab=stats');
    await screen.findByTestId('team-nav');
    expect(popup()).toBeNull();
  });
});

describe('quick tour', () => {
  it('quick pages show their tips; the builder ends with where to find more', async () => {
    seed('quick');
    await renderApp('/match/m1');
    expect(await screen.findByTestId('tour-popup')).toBeTruthy();
    await press('tour-next');
    expect(screen.getByTestId('tour-visual-court', includeHidden)).toBeTruthy();
    await press('tour-next');
    expect(screen.getByTestId('tour-quick-done')).toBeTruthy();
    expect(screen.getByText(t.tour.popup.quickDone)).toBeTruthy();
    await press('tour-done');
    expect(seen()).toEqual(['builder']);
  });

  it('other pages offer a quick tip once: No thanks marks the page seen', async () => {
    seed('quick', ['roster']);
    await renderApp('/team/team1?tab=starters');
    expect(await screen.findByTestId('tour-offer')).toBeTruthy();
    expect(screen.getByText(t.tour.offer.title(t.tour.pages.starters))).toBeTruthy();
    expect(popup()).toBeNull();
    await press('tour-offer-no');
    expect(offer()).toBeNull();
    expect(popup()).toBeNull();
    expect(seen()).toEqual(['roster', 'starters']);
  });

  it('Show me opens the tips (the page is seen)', async () => {
    seed('quick');
    await renderApp('/settings');
    expect(await screen.findByTestId('tour-offer')).toBeTruthy();
    await press('tour-offer-show');
    expect(offer()).toBeNull();
    expect(screen.getByText(tips.settings.display.title)).toBeTruthy();
    expect(screen.getByTestId('tour-visual-toggle', includeHidden)).toBeTruthy();
    expect(seen()).toEqual(['settings']);
  });
});

describe('no tour', () => {
  it.each([
    '/',
    '/teams',
    '/profile',
    '/team/team1?tab=roster',
    '/team/team1?tab=starters',
    '/team/team1/player',
    '/match/m1',
    '/match/m1/live',
  ])('%s shows no tips', async (url) => {
    seed('none');
    await renderApp(url);
    await act(async () => {});
    expect(screen.queryByTestId('tour-choice')).toBeNull();
    expect(popup()).toBeNull();
    expect(offer()).toBeNull();
  });
});

describe('Profile → Tutorial', () => {
  it('Cancel keeps everything; choosing again restarts the tour', async () => {
    seed('quick', ['profiles', 'teams', 'profile']);
    await renderApp('/profile');
    expect(await screen.findByText(t.tour.profile.title)).toBeTruthy();
    expect(screen.getByText(t.tour.choice.current(t.tour.choice.quick))).toBeTruthy();
    expect(popup()).toBeNull();

    await press('tour-choose-again');
    expect(screen.getByTestId('tour-choice')).toBeTruthy();
    // From Profile: "Tutorial" (not the welcome), with Cancel.
    expect(screen.queryByText(t.tour.choice.title)).toBeNull();
    await press('tour-choice-cancel');
    expect(screen.queryByTestId('tour-choice')).toBeNull();
    expect(useAppStore.getState().tourMode).toBe('quick');
    expect(seen()).toEqual(['profiles', 'teams', 'profile']);

    await press('tour-choose-again');
    await press('tour-choose-full');
    expect(useAppStore.getState().tourMode).toBe('full');
    // Started over: the Profile tab's tips right away.
    expect(screen.getByText(tips.profile.look.title)).toBeTruthy();
    await press('tour-next');
    await press('tour-done');
    expect(seen()).toEqual(['profile']);

    await press('tour-choose-again');
    await press('tour-choose-none');
    expect(useAppStore.getState().tourMode).toBe('none');
    expect(screen.getByText(t.tour.choice.current(t.tour.choice.none))).toBeTruthy();
  });
});

describe('tips content', () => {
  it('every page has 1–3 tips with a title and text, in English and German', () => {
    for (const strings of [t, de]) {
      for (const page of TOUR_PAGES) {
        const steps = tourSteps(strings, page);
        expect(steps.length).toBeGreaterThanOrEqual(1);
        expect(steps.length).toBeLessThanOrEqual(3);
        for (const s of steps) {
          expect(s.title.length).toBeGreaterThan(0);
          expect(s.text.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
