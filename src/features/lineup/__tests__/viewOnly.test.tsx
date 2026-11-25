import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { emptySetLineup } from '@/domain/lineup';
import type { TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { seedTeam } from '@/test-utils/presetsTeam';

/*
 * v10: the lineup builder for a view-only member (player role of a shared team) and for a match
 * scored live on another device. Views have no layout in Jest: drop zones get a fake layout.
 */
const layout: Record<string, { x: number; y: number; width: number; height: number }> = {
  'court-slot-4': { x: 0, y: 0, width: 100, height: 100 },
  'court-slot-3': { x: 100, y: 0, width: 100, height: 100 },
  bench: { x: 0, y: 500, width: 300, height: 200 },
};
const ORIGIN = { x: 0, y: 0, width: 0, height: 0 };

jest.mock('@/lib/measureInWindow', () => ({
  measureInWindow: (view: { props?: { testID?: string } }) =>
    Promise.resolve(layout[view.props?.testID ?? ''] ?? ORIGIN),
}));

const EDIT_CONTROLS = [
  'formation-controls',
  'rotate-clockwise',
  'template-open',
  'use-starters',
  'apply-preset',
  'copy-previous',
  'clear-lineup',
  'libero-replaces',
];

function seed(role: TeamRole | null) {
  seedTeam();
  const set1 = emptySetLineup(1);
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
        sets: [{ ...set1, slots: { ...set1.slots, 1: 'p1', 2: 'p2' }, liberoId: 'p7' }],
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

const set1 = () => useAppStore.getState().matches[0].sets[0];

async function dragTo(gestureTestId: string, x: number, y: number) {
  const gesture = getByGestureTestId(gestureTestId);
  await act(async () => {
    fireGestureHandler(gesture, [
      { state: State.BEGAN, absoluteX: 5, absoluteY: 600 },
      { state: State.ACTIVE, absoluteX: 5, absoluteY: 600 },
      { state: State.ACTIVE, absoluteX: x, absoluteY: y },
      { state: State.END, absoluteX: x, absoluteY: y },
    ]);
  });
}

beforeEach(() => jest.clearAllMocks());

describe('lineup builder, view only (v10)', () => {
  it('a viewer sees the lineup but cannot drag, tap-place or use any edit control', async () => {
    seed('player');
    const before = set1();
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    const bench = await screen.findByTestId('bench');

    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    for (const id of EDIT_CONTROLS) expect(screen.queryByTestId(id)).toBeNull();
    // The links stay (rotation, live, stats, …), the serve choice shows but is disabled.
    expect(screen.getByTestId('open-live')).toBeTruthy();
    expect(screen.getByTestId('serve-us').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByTestId('lineup-locked')).toBeNull();

    // Tap a bench player, then an empty spot: nothing is placed (nor selected).
    await fireEvent.press(within(bench).getByTestId('bench-player-3'));
    await fireEvent.press(screen.getByTestId('slot-empty-3'));
    // Tap the libero chip and the court players: no selection, no move.
    await fireEvent.press(screen.getByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('slot-empty-4'));
    // Drag a bench player onto the court: the drag never starts.
    await dragTo('drag-bench-player-3', 150, 50);
    await dragTo('drag-slot-player-1', 50, 50);

    expect(set1()).toBe(before);
    expect(screen.queryByTestId('drag-overlay')).toBeNull();
    expect(screen.getByTestId('slot-empty-3').props.accessibilityState.disabled).toBe(true);
  });

  it.each(['manager', null] as const)(
    'a %s team keeps the full builder (manager of a shared team / local team)',
    async (role) => {
      seed(role);
      await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
      const bench = await screen.findByTestId('bench');
      expect(screen.queryByTestId('read-only-note')).toBeNull();
      for (const id of EDIT_CONTROLS) expect(screen.getByTestId(id)).toBeTruthy();

      await fireEvent.press(within(bench).getByTestId('bench-player-3'));
      await fireEvent.press(screen.getByTestId('slot-empty-3'));
      expect(set1().slots[3]).toBe('p3');
      await dragTo('drag-bench-player-4', 50, 50);
      expect(set1().slots[4]).toBe('p4');
    },
  );

  it('a match scored on another device is read-only for a manager, with Take over', async () => {
    seed('manager');
    holdElsewhere();
    const before = set1();
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    const bench = await screen.findByTestId('bench');
    expect(screen.getByText(t.sync.readOnly.held('Anna'))).toBeTruthy();
    for (const id of EDIT_CONTROLS) expect(screen.queryByTestId(id)).toBeNull();
    await fireEvent.press(within(bench).getByTestId('bench-player-3'));
    await fireEvent.press(screen.getByTestId('slot-empty-3'));
    expect(set1()).toBe(before);

    await fireEvent.press(screen.getByRole('button', { name: t.sync.readOnly.takeOver }));
    expect(sync.holdMatch).toHaveBeenCalledWith('team1', 'm1', true);
  });

  it('a failed Take over says why', async () => {
    seed('manager');
    holdElsewhere();
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    const takeOver = await screen.findByRole('button', { name: t.sync.readOnly.takeOver });
    const cases = [
      [{ ok: false, error: 'offline' }, t.sync.match.takeOverFailed.offline],
      [{ ok: false, error: 'forbidden' }, t.sync.match.takeOverFailed.forbidden],
      [{ ok: false, error: 'unknown' }, t.sync.match.takeOverFailed.other],
      [{ ok: true, value: { granted: false } }, t.sync.match.takeOverFailed.other],
    ] as const;
    for (const [result, message] of cases) {
      jest.mocked(sync.holdMatch).mockResolvedValueOnce(result);
      await fireEvent.press(takeOver);
      expect(screen.getByTestId('take-over-error').props.children).toBe(message);
    }
    await fireEvent.press(takeOver);
    expect(screen.queryByTestId('take-over-error')).toBeNull();
  });
});
