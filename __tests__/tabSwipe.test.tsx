import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { renderRouter } from 'expo-router/testing-library';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { Match, Player, Position, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';
import { usePhotoStore } from '@/store/photoStore';

/* v8 (PLAN §31.2): tab switches still change content with the slide in place, and a sideways
 * swipe goes to the next / previous tab. */

const player = (n: number, positions: Position[]): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: `P${n}`,
  lastName: 'Test',
  number: n,
  positions,
  active: true,
});
const players = [
  player(1, ['S']),
  player(2, ['OH']),
  player(3, ['MB']),
  player(4, ['OPP']),
  player(5, ['OH']),
  player(6, ['MB']),
];
const set1: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: null,
  weServeFirst: false,
  liberoReplaces: [],
  events: [
    { type: 'point', winner: 'us', kind: 'kill', playerId: 'p2' },
    { type: 'point', winner: 'them' },
  ],
};

beforeEach(() => {
  const match: Match = {
    id: 'm1',
    teamId: 'team1',
    seasonId: 's1',
    opponentId: 'o1',
    opponent: 'Rivals',
    date: '2026-11-20',
    home: true,
    sets: [set1],
  };
  const now = '2026-01-01T00:00:00.000Z';
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof1', name: 'Coach', color: '#FF6B00', createdAt: now }],
    teams: [{ id: 'team1', profileId: 'prof1', name: 'Herren 1', createdAt: now }],
    players,
    matches: [match],
    seasons: [{ id: 's1', teamId: 'team1', name: '2026', kind: 'season', createdAt: now }],
    opponents: [{ id: 'o1', seasonId: 's1', name: 'Rivals', createdAt: now }],
    currentProfileId: 'prof1',
  });
  usePhotoStore.setState({ photos: {}, hydrated: true });
});

const swipe = (id: string, dx: number) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(id), [
      { translationX: 0 },
      { translationX: dx / 2 },
      { translationX: dx },
    ]),
  );

describe('team nav bar', () => {
  it('changes tab on a tap and on a swipe', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1' });
    expect(await screen.findByTestId('team-tab-roster')).toBeSelected();

    await fireEvent.press(screen.getByTestId('team-tab-stats'));
    expect(screen.getByTestId('team-tab-stats')).toBeSelected();

    await swipe('team-tab-swipe', 120); // right → previous tab
    expect(screen.getByTestId('team-tab-starters')).toBeSelected();
    await swipe('team-tab-swipe', -120); // left → next tab
    expect(screen.getByTestId('team-tab-stats')).toBeSelected();
    await swipe('team-tab-swipe', -120); // already the last tab
    expect(screen.getByTestId('team-tab-stats')).toBeSelected();
  });
});

describe('season tabs', () => {
  it('changes tab on a tap and on a swipe', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1/season/s1' });
    expect(await screen.findByTestId('season-tab-matches')).toBeSelected();
    await swipe('season-tab-swipe', -120);
    expect(screen.getByTestId('season-tab-opponents')).toBeSelected();
    await fireEvent.press(screen.getByTestId('season-tab-stats'));
    expect(screen.getByTestId('season-tab-stats')).toBeSelected();
  });
});

describe('live mode', () => {
  it('swipes between Live and Performance; the set switch inside only slides', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByTestId('point-us')).toBeTruthy();
    await swipe('live-view-swipe', -120);
    expect(screen.getByTestId('performance')).toBeTruthy();
    expect(screen.queryByTestId('point-us')).toBeNull();
    // Nested in the Live ↔ Performance swipe, the set switch has no swipe of its own.
    expect(() => getByGestureTestId('perf-set-swipe')).toThrow();
    await swipe('live-view-swipe', 120);
    expect(screen.getByTestId('point-us')).toBeTruthy();
  });

  it('keeps Live and the open tag row when a swipe starts on the tag row (v8 QA)', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    const swipeFromRow = async () => {
      await act(() => fireGestureHandler(getByGestureTestId('point-tag-row-no-swipe'), [{}, {}]));
      await swipe('live-view-swipe', -120);
    };
    await fireEvent.press(await screen.findByTestId('point-us'));
    // The kinds row…
    await swipeFromRow();
    expect(screen.queryByTestId('performance')).toBeNull();
    expect(screen.getByTestId('tag-close')).toBeTruthy();
    // …and the player row (kind chip and ✕ included) block the Live ↔ Performance swipe.
    await fireEvent.press(screen.getByTestId('tag-kill'));
    expect(screen.getByTestId('tag-player-p2')).toBeTruthy();
    await swipeFromRow();
    expect(screen.queryByTestId('performance')).toBeNull();
    expect(screen.getByTestId('tag-kill')).toBeTruthy();
    expect(screen.getByTestId('tag-player-p2')).toBeTruthy();
  });
});

describe('match stats set filter', () => {
  it('changes the set on a tap and on a swipe', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/stats' });
    expect(await screen.findByTestId('stats-set-all')).toBeSelected();
    await swipe('stats-set-swipe', -120);
    expect(screen.getByTestId('stats-set-1')).toBeSelected();
    await fireEvent.press(screen.getByTestId('stats-set-all'));
    expect(screen.getByTestId('stats-set-all')).toBeSelected();
  });
});

describe('match performance set switch', () => {
  it('swipes from set 1 to all sets', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/performance?set=1' });
    expect(await screen.findByTestId('perf-set-1')).toBeSelected();
    await swipe('perf-set-swipe', -120);
    expect(screen.getByTestId('perf-set-all')).toBeSelected();
  });
});

/*
 * v8.1.1 flicker regression: a page dragged in must be the very element that becomes the shown
 * tab (v8.1 showed a copy and then mounted the real page, a visible flash on Android). The host
 * element of a page found before the drag is the same instance after it: nothing was remounted.
 */
describe('no remount on a tab change (v8.1.1)', () => {
  const hidden = { includeHiddenElements: true };

  it('team tabs: the neighbouring tab is mounted before the drag and kept after it', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1' });
    expect(await screen.findByTestId('team-tab-roster')).toBeSelected();
    await act(() => jest.runOnlyPendingTimers());
    const seasons = screen.getByTestId('season-list', hidden);
    expect(screen.queryByTestId('season-list')).toBeNull(); // mounted, hidden
    await swipe('team-tab-swipe', -120);
    expect(screen.getByTestId('team-tab-matches')).toBeSelected();
    expect(screen.getByTestId('season-list')).toBe(seasons);
    // A tap back slides the roster in: still the same pages.
    await fireEvent.press(screen.getByTestId('team-tab-roster'));
    expect(screen.getByTestId('season-list', hidden)).toBe(seasons);
  });

  it('app tab bar: the Profile screen dragged in is the real one, not a copy', async () => {
    // v12: Profile's left neighbour is Tournaments.
    await renderRouter('./app', { initialUrl: '/tournaments' });
    const card = await screen.findByTestId('profile-card', hidden);
    await swipe('app-tab-swipe-tournaments', -120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/profile');
    expect(screen.getByTestId('profile-card')).toBe(card);
    await fireEvent.press(screen.getByTestId('tab-teams'));
    expect(screen).toHavePathname('/teams');
    expect(screen.getByTestId('profile-card', hidden)).toBe(card);
  });
});

/*
 * v8.1.1 review: a page beside the shown one must be drawable, or a drag shows empty background
 * and the page pops in on commit. Nothing around it may be `display: 'none'` or fully transparent
 * (Jest runs as a phone, where react-native-screens hides inactive scenes that way). The page's
 * own opacity is the pager's (0 only before it is measured), so the walk starts at its parent.
 */
describe('pages beside the shown one are drawable (v8.1.1)', () => {
  const hidden = { includeHiddenElements: true };
  type Host = ReturnType<typeof screen.getByTestId>;
  const hiddenAncestor = (el: Host) => {
    for (let node: Host | null = el.parent; node; node = node.parent) {
      const style = StyleSheet.flatten(node.props.style as StyleProp<ViewStyle>) ?? {};
      if (style.display === 'none' || style.opacity === 0) return node.props.testID ?? node.type;
    }
    return null;
  };

  it('app tab bar: the unfocused scenes are mounted and not hidden by the navigator', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    await screen.findByTestId('app-tab-swipe-teams-pager');
    for (const tab of ['profile', 'settings']) {
      const pager = screen.getByTestId(`app-tab-swipe-${tab}-pager`, hidden);
      expect(hiddenAncestor(pager)).toBeNull();
    }
    // Also after a tab change (the old focused scene).
    await fireEvent.press(screen.getByTestId('tab-profile'));
    await act(() => jest.runOnlyPendingTimers());
    expect(hiddenAncestor(screen.getByTestId('app-tab-swipe-teams-pager', hidden))).toBeNull();
  });

  it('inner pagers: the neighbouring pages are mounted and not hidden', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1?tab=matches' });
    await screen.findByTestId('team-tab-swipe-pager');
    await act(() => jest.runOnlyPendingTimers());
    for (const key of ['roster', 'presets']) {
      const page = screen.getByTestId(`team-tab-swipe-page-${key}`, hidden);
      expect(hiddenAncestor(page)).toBeNull();
    }
  });
});

describe('app tab bar (v8.1)', () => {
  // v12: Tournaments sits between Teams and Profile.
  it('drags from Teams onto Tournaments, on to Profile, and back', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    expect(await screen.findByTestId('app-tab-swipe-teams-pager')).toBeTruthy();
    await swipe('app-tab-swipe-teams', -120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/tournaments');
    await swipe('app-tab-swipe-tournaments', -120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/profile');
    await swipe('app-tab-swipe-profile', 120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/tournaments');
    await swipe('app-tab-swipe-tournaments', 120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/teams');
  });

  it('taps through the four tabs', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    await screen.findByTestId('app-tab-swipe-teams-pager');
    for (const tab of ['tournaments', 'profile', 'settings', 'teams'] as const) {
      await fireEvent.press(screen.getByTestId(`tab-${tab}`));
      await act(() => jest.runOnlyPendingTimers());
      expect(screen).toHavePathname(`/${tab}`);
    }
  });
});
