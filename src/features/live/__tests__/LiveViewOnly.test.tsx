import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { SetEvent, SetLineup, SetNumber, TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { fullLineup, seedTeam } from '@/test-utils/presetsTeam';

import { HOLD_REFRESH_MS, useMatchHold } from '../useMatchHold';

/* v10: live mode for watchers (view-only members, a match scored elsewhere) and the live hold. */

const points = (n: number): SetEvent[] =>
  Array.from({ length: n }, () => ({ type: 'point', winner: 'us' }) as const);

const lineupSet = (setNumber: SetNumber, events: SetEvent[] = []): SetLineup => ({
  ...fullLineup(),
  setNumber,
  weServeFirst: true,
  events,
});

function seed(role: TeamRole | null, sets: SetLineup[] = [lineupSet(1, points(3))]) {
  seedTeam();
  useAppStore.setState({
    matches: [
      {
        id: 'm1',
        teamId: 'team1',
        seasonId: 's1',
        opponentId: 'o1',
        opponent: 'Rivals',
        date: '2026-11-20',
        home: true,
        sets,
      },
    ],
    sync: {
      deviceId: 'dev1',
      account: role ? { userId: 'u1', email: 'a@example.test', profileId: 'prof' } : null,
      teams: role
        ? { team1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } }
        : {},
    },
  });
}

const holdElsewhere = () =>
  useSyncRuntime.setState({
    holds: {
      m1: {
        matchId: 'm1',
        teamId: 'team1',
        deviceId: 'dev2',
        userId: 'u2',
        holderName: 'Anna',
        heldUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
    },
  });

const WATCH_HIDDEN = ['point-us', 'point-them', 'sub-panel', 'undo', 'reset-live', 'serve-us'];

beforeEach(() => jest.clearAllMocks());

describe('live mode, watching (v10)', () => {
  it('a viewer sees the score and court only, follows the match and never holds it', async () => {
    seed('player');
    const view = await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByTestId('scoreboard')).toBeTruthy();
    expect(screen.getByTestId('score-us').props.children).toBe(3);
    expect(screen.getByTestId('live-court')).toBeTruthy();
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    for (const id of WATCH_HIDDEN) expect(screen.queryByTestId(id)).toBeNull();
    // Court players are shown, not tappable (no substitution).
    expect(screen.queryByText(t.live.courtPlayerHint)).toBeNull();

    expect(sync.followMatch).toHaveBeenCalledWith('m1');
    expect(sync.holdMatch).not.toHaveBeenCalled();
    await view.unmount();
    expect(sync.followMatch).toHaveBeenLastCalledWith(null);
    expect(sync.releaseMatch).not.toHaveBeenCalled();
  });

  it('a match scored on another device: note with Take over, no scoring controls', async () => {
    seed('manager');
    holdElsewhere();
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText(t.sync.readOnly.held('Anna'))).toBeTruthy();
    for (const id of WATCH_HIDDEN) expect(screen.queryByTestId(id)).toBeNull();
    expect(sync.followMatch).toHaveBeenCalledWith('m1');

    await fireEvent.press(screen.getByRole('button', { name: t.sync.readOnly.takeOver }));
    expect(sync.holdMatch).toHaveBeenCalledWith('team1', 'm1', true);
    // Once this device holds it, it scores again and stops following.
    await act(async () => useSyncRuntime.setState({ holds: {} }));
    expect(await screen.findByTestId('point-us')).toBeTruthy();
    expect(screen.queryByTestId('read-only-note')).toBeNull();
    expect(sync.followMatch).toHaveBeenLastCalledWith(null);
  });

  it('a won set offers only "Go to set" for a set that exists; summary without Undo', async () => {
    seed('player', [lineupSet(1, points(25))]);
    const view = await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByTestId('set-won-panel')).toBeTruthy();
    expect(screen.queryByTestId('next-set')).toBeNull();
    expect(screen.queryByTestId('undo')).toBeNull();
    await view.unmount();

    // The next set exists: watchers can go there; a set not set up yet is "not started".
    seed('player', [lineupSet(1, points(25)), { ...lineupSet(2), slots: fullLineup().slots }]);
    const second = await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await fireEvent.press(await screen.findByRole('button', { name: t.live.goToSet(2) }));
    expect(useAppStore.getState().matches[0].sets).toHaveLength(2);
    expect(screen.getByTestId('scoreboard')).toBeTruthy();
    await second.unmount();

    seed('player', [lineupSet(1, points(25))]);
    const third = await renderRouter('./app', { initialUrl: '/match/m1/live?set=2' });
    expect(await screen.findByText(t.sync.match.notStarted(2))).toBeTruthy();
    expect(screen.queryByTestId('set-setup')).toBeNull();
    await third.unmount();

    seed(
      'player',
      [1, 2, 3].map((n) => lineupSet(n as SetNumber, points(25))),
    );
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=3' });
    expect(await screen.findByTestId('match-summary')).toBeTruthy();
    expect(screen.getByTestId('summary-back')).toBeTruthy();
    expect(screen.queryByTestId('undo')).toBeNull();
  });

  it('a set without a full lineup is "not started" for watchers', async () => {
    seed('player', [{ ...lineupSet(1), slots: { ...fullLineup().slots, 6: null } }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText(t.sync.match.notStarted(1))).toBeTruthy();
  });
});

describe('live hold (v10)', () => {
  it('a manager of a shared team holds the match while live is open and scores as usual', async () => {
    seed('manager');
    const view = await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await fireEvent.press(await screen.findByTestId('point-us'));
    expect(useAppStore.getState().matches[0].sets[0].events).toHaveLength(4);
    expect(sync.holdMatch).toHaveBeenCalledWith('team1', 'm1');
    expect(sync.followMatch).not.toHaveBeenCalled();
    await view.unmount();
    expect(sync.releaseMatch).toHaveBeenCalledWith('team1', 'm1');
  });

  it('a local team never holds, releases or follows', async () => {
    seed(null);
    const view = await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByTestId('point-us')).toBeTruthy();
    expect(screen.queryByTestId('read-only-note')).toBeNull();
    await view.unmount();
    expect(sync.holdMatch).not.toHaveBeenCalled();
    expect(sync.releaseMatch).not.toHaveBeenCalled();
    expect(sync.followMatch).not.toHaveBeenCalled();
  });

  it('refreshes the hold every 5 minutes while mounted', async () => {
    jest.useFakeTimers();
    try {
      seed('manager');
      const hook = await renderHook(() => useMatchHold('m1'));
      expect(sync.holdMatch).toHaveBeenCalledTimes(1);
      await act(async () => jest.advanceTimersByTime(HOLD_REFRESH_MS));
      expect(sync.holdMatch).toHaveBeenCalledTimes(2);
      await act(async () => jest.advanceTimersByTime(HOLD_REFRESH_MS));
      expect(sync.holdMatch).toHaveBeenCalledTimes(3);
      await hook.unmount();
      await act(async () => jest.advanceTimersByTime(HOLD_REFRESH_MS));
      expect(sync.holdMatch).toHaveBeenCalledTimes(3);
      expect(sync.releaseMatch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
