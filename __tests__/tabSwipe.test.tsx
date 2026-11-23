import { act, fireEvent, screen } from '@testing-library/react-native';
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

describe('app tab bar (v8.1)', () => {
  it('drags from Teams onto Profile and back', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    expect(await screen.findByTestId('app-tab-swipe-teams-pager')).toBeTruthy();
    await swipe('app-tab-swipe-teams', -120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/profile');
    await swipe('app-tab-swipe-profile', 120);
    await act(() => jest.runOnlyPendingTimers());
    expect(screen).toHavePathname('/teams');
  });
});
