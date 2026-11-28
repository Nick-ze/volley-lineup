import {
  isQuickPage,
  LAST_QUICK_PAGE,
  liveViewPage,
  OTHER_PAGES,
  QUICK_PAGES,
  seasonTabPage,
  teamTabPage,
  TOUR_PAGES,
  tourAction,
  tournamentTabPage,
  withSeen,
} from './tour';
import type { TourPage } from './types';

describe('tour pages', () => {
  it('lists the quick path in walk-through order, ending in the lineup builder', () => {
    expect(QUICK_PAGES).toEqual([
      'profiles',
      'teams',
      'roster',
      'playerForm',
      'matches',
      'seasonForm',
      'seasonMatches',
      'matchForm',
      'builder',
    ]);
    expect(QUICK_PAGES[QUICK_PAGES.length - 1]).toBe(LAST_QUICK_PAGE);
  });

  it('has every page once, quick pages first', () => {
    expect(TOUR_PAGES).toEqual([...QUICK_PAGES, ...OTHER_PAGES]);
    expect(new Set(TOUR_PAGES).size).toBe(TOUR_PAGES.length);
    // v10: + account, signIn, cloudTeams, members, join; v12: + the seven tournament pages
    expect(TOUR_PAGES).toHaveLength(36);
    expect(OTHER_PAGES.filter((page) => page.startsWith('tournament'))).toHaveLength(7);
  });

  it('tells quick pages from the others', () => {
    for (const page of QUICK_PAGES) expect(isQuickPage(page)).toBe(true);
    for (const page of OTHER_PAGES) expect(isQuickPage(page)).toBe(false);
  });
});

describe('tourAction', () => {
  it('does nothing before a tour is chosen, with no tour, or without a page', () => {
    for (const page of TOUR_PAGES) {
      expect(tourAction(null, [], page)).toBe('none');
      expect(tourAction('none', [], page)).toBe('none');
    }
    expect(tourAction('full', [], null)).toBe('none');
    expect(tourAction('quick', [], null)).toBe('none');
  });

  it('full tour: every page shows its tips until seen', () => {
    for (const page of TOUR_PAGES) {
      expect(tourAction('full', [], page)).toBe('steps');
      expect(tourAction('full', [page], page)).toBe('none');
    }
  });

  it('quick tour: quick pages show their tips, the others offer them, until seen', () => {
    for (const page of QUICK_PAGES) {
      expect(tourAction('quick', [], page)).toBe('steps');
      expect(tourAction('quick', [page], page)).toBe('none');
    }
    for (const page of OTHER_PAGES) {
      expect(tourAction('quick', [], page)).toBe('offer');
      expect(tourAction('quick', [page], page)).toBe('none');
    }
    // Other pages being seen doesn't matter.
    expect(tourAction('quick', ['roster'], 'teams')).toBe('steps');
  });
});

describe('withSeen', () => {
  it('adds a page once and never changes the given list', () => {
    const seen: TourPage[] = ['profiles'];
    expect(withSeen(seen, 'teams')).toEqual(['profiles', 'teams']);
    expect(withSeen(seen, 'profiles')).toEqual(['profiles']);
    expect(withSeen(seen, 'profiles')).not.toBe(seen);
    expect(seen).toEqual(['profiles']);
  });
});

describe('tab pages', () => {
  it('maps the team tabs', () => {
    expect(teamTabPage('roster')).toBe('roster');
    expect(teamTabPage('matches')).toBe('matches');
    expect(teamTabPage('presets')).toBe('presets');
    expect(teamTabPage('starters')).toBe('starters');
    expect(teamTabPage('stats')).toBe('teamStats');
  });

  it('maps the season tabs', () => {
    expect(seasonTabPage('matches')).toBe('seasonMatches');
    expect(seasonTabPage('opponents')).toBe('seasonOpponents');
    expect(seasonTabPage('stats')).toBe('seasonStats');
  });

  it('maps the live views', () => {
    expect(liveViewPage('live')).toBe('live');
    expect(liveViewPage('performance')).toBe('performance');
  });
});

describe('hosted tournament pages (v12)', () => {
  it('maps a tournament tab to its page', () => {
    expect(tournamentTabPage('table')).toBe('tournamentTable');
    expect(tournamentTabPage('matches')).toBe('tournamentMatches');
    expect(tournamentTabPage('teams')).toBe('tournamentTeams');
  });

  it('are not part of the quick tour: offered there, shown in the full tour', () => {
    expect(isQuickPage('tournaments')).toBe(false);
    expect(tourAction('quick', [], 'tournaments')).toBe('offer');
    expect(tourAction('full', [], 'tournamentResult')).toBe('steps');
  });
});
