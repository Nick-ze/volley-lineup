import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { emptySetLineup } from '@/domain/lineup';
import type { Player } from '@/domain/types';
import { useAppStore } from '@/store';

/*
 * Drag & drop with simulated pan gestures. Views have no layout in Jest, so the window
 * measurement is replaced by a fake layout keyed by the measured view's testID.
 */
const layout: Record<string, { x: number; y: number; width: number; height: number }> = {
  'court-slot-4': { x: 0, y: 0, width: 100, height: 100 },
  'court-slot-3': { x: 100, y: 0, width: 100, height: 100 },
  'court-slot-2': { x: 200, y: 0, width: 100, height: 100 },
  'libero-slot': { x: 0, y: 300, width: 100, height: 100 },
  bench: { x: 0, y: 500, width: 300, height: 200 },
};
const ORIGIN = { x: 0, y: 0, width: 0, height: 0 };

jest.mock('@/lib/measureInWindow', () => ({
  measureInWindow: (view: { props?: { testID?: string } }) =>
    Promise.resolve(layout[view.props?.testID ?? ''] ?? ORIGIN),
}));

const player = (n: number): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: `F${n}`,
  lastName: `L${n}`,
  number: n,
  // Listed for every spot used below (4 OPP, 3 MB in the default formation): no "Are you sure?".
  positions: ['OH', 'OPP', 'MB'],
  active: true,
});

const sets = () => useAppStore.getState().matches[0].sets;
const set1 = () => sets()[0];

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

describe('lineup builder drag & drop', () => {
  beforeEach(() => {
    useAppStore.getState().resetAll();
    useAppStore.setState({
      hydrated: true,
      teams: [{ id: 'team1', profileId: 'prof', name: 'H', createdAt: '' }],
      players: [player(1), player(2), player(3)],
      matches: [
        {
          id: 'm1',
          teamId: 'team1',
          opponent: 'R',
          date: '',
          home: true,
          sets: [emptySetLineup(1)],
        },
      ],
    });
  });

  it('drags bench → slot, slot → slot, slot → libero and libero → bench', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await screen.findByTestId('bench');

    await dragTo('drag-bench-player-1', 50, 50);
    expect(set1().slots[4]).toBe('p1');
    expect(within(screen.getByTestId('bench')).queryByTestId('bench-player-1')).toBeNull();

    await dragTo('drag-bench-player-2', 150, 50);
    await dragTo('drag-slot-player-4', 150, 50); // swap 4 ↔ 3
    expect([set1().slots[4], set1().slots[3]]).toEqual(['p2', 'p1']);

    await dragTo('drag-slot-player-3', 50, 350);
    expect(set1().liberoId).toBe('p1');
    expect(set1().slots[3]).toBeNull();

    await dragTo('drag-libero-player', 100, 600);
    expect(set1().liberoId).toBeNull();
    expect(within(screen.getByTestId('bench')).getByTestId('bench-player-1')).toBeTruthy();
  });

  it('dropping an unlisted player on a spot asks first (Cancel: nothing; Confirm: placed + "*")', async () => {
    useAppStore.setState((st) => ({
      players: [...st.players, { ...player(4), positions: ['OH'] }],
    }));
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await screen.findByTestId('bench');
    await dragTo('drag-bench-player-4', 150, 50); // spot 3 = MB
    expect(screen.getByTestId('placement-confirm')).toHaveTextContent(
      /#4 F4 L4 isn’t listed as Middle Blocker/,
    );
    await fireEvent.press(screen.getByTestId('placement-cancel'));
    expect(set1().slots[3]).toBeNull();
    expect(screen.queryByTestId('placement-confirm')).toBeNull();

    await dragTo('drag-bench-player-4', 150, 50);
    await fireEvent.press(screen.getByTestId('placement-confirm-button'));
    expect(set1().slots[3]).toBe('p4');
    expect(screen.getByTestId('role-off-3', { includeHiddenElements: true })).toBeTruthy();
  });

  it('does nothing when dropped outside any zone', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await screen.findByTestId('bench');
    await dragTo('drag-bench-player-1', 900, 900);
    expect(set1().slots).toEqual(emptySetLineup(1).slots);
  });

  it('dropping a chip back on its own zone does not save an unsaved set', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    await screen.findByTestId('bench');
    await dragTo('drag-bench-player-1', 100, 600);
    expect(sets()).toHaveLength(1);
  });
});
