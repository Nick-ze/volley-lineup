import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { useAppStore } from '@/store';

import { seedStore } from '../__fixtures__/seed';

/** Jersey number shown at a court spot. */
const numberAt = (position: number) =>
  within(screen.getByTestId(`court-slot-${position}`)).getByTestId(`spot-${position}`);

const expectLineup = (expected: Record<number, string>) => {
  for (const [pos, num] of Object.entries(expected)) {
    expect(within(numberAt(Number(pos))).getByText(num)).toBeTruthy();
  }
};

describe('rotation viewer', () => {
  beforeEach(() => seedStore());

  it('starts at rotation 1, Next rotates clockwise and wraps 6 → 1', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });

    expect(await screen.findByText('Rotation 1 of 6')).toBeTruthy();
    expectLineup({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' });
    // The server (position 1) is announced, front row distinguished.
    expect(
      screen.getByLabelText(/^Position 1, Back row: Number 1, S Setter, Setter, server$/),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Position 3, Front row: Number 3/)).toBeTruthy();
    // Libero and serve info.
    expect(screen.getByTestId('libero-chip')).toBeTruthy();
    expect(screen.getByText('We serve first')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));
    expect(screen.getByText('Rotation 2 of 6')).toBeTruthy();
    // 2→1, 3→2, 4→3, 5→4, 6→5, 1→6
    expectLineup({ 1: '2', 2: '3', 3: '4', 4: '5', 5: '6', 6: '1' });

    for (let i = 0; i < 4; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));
    }
    expect(screen.getByText('Rotation 6 of 6')).toBeTruthy();
    expectLineup({ 1: '6', 2: '1', 3: '2', 4: '3', 5: '4', 6: '5' });

    await fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));
    expect(screen.getByText('Rotation 1 of 6')).toBeTruthy();
    expectLineup({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' });
  });

  it('Previous wraps 1 → 6 and the stepper jumps to a rotation', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 of 6');

    await fireEvent.press(screen.getByRole('button', { name: 'Previous rotation' }));
    expect(screen.getByText('Rotation 6 of 6')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Show rotation 4' }));
    expect(screen.getByText('Rotation 4 of 6')).toBeTruthy();
    expectLineup({ 1: '4', 2: '5', 3: '6', 4: '1', 5: '2', 6: '3' });
  });

  it('swiping left shows the next rotation, swiping right the previous one', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 of 6');
    const swipe = (dx: number) =>
      act(() =>
        fireGestureHandler(getByGestureTestId('rotation-swipe'), [
          { translationX: 0 },
          { translationX: dx / 2 },
          { translationX: dx },
        ]),
      );

    await swipe(-120);
    expect(screen.getByText('Rotation 2 of 6')).toBeTruthy();
    await swipe(120);
    await swipe(120);
    expect(screen.getByText('Rotation 6 of 6')).toBeTruthy();
    await swipe(-10); // too short: ignored
    expect(screen.getByText('Rotation 6 of 6')).toBeTruthy();
  });

  it('switches set via the tabs, resetting to rotation 1', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 of 6');
    await fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));

    await fireEvent.press(screen.getByRole('tab', { name: 'Show set 2' }));
    expect(await screen.findByText('We receive first')).toBeTruthy();
    expect(screen.getByText('Rotation 1 of 6')).toBeTruthy();
    expectLineup({ 1: '2', 6: '1' });
    expect(screen.getByText('No libero')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Show set 2' })).toBeSelected();
    // Only existing sets get tabs.
    expect(screen.queryByRole('tab', { name: 'Show set 4' })).toBeNull();
  });

  it('shows an empty set gracefully', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=3' });
    expect(await screen.findByText(/No players in this set yet/)).toBeTruthy();
    expect(screen.getByLabelText('Position 1, Back row: empty')).toBeTruthy();
  });

  it('falls back to the first set for an unknown set param', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=9' });
    expect(await screen.findByText('We serve first')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Show set 1' })).toBeSelected();
  });

  it('shows a message for a missing match or a match without sets', async () => {
    await renderRouter('./app', { initialUrl: '/match/nope/rotation' });
    expect(await screen.findByText('This match could not be found.')).toBeTruthy();
  });

  it('shows a message for a match without sets', async () => {
    const m = useAppStore.getState().matches[0];
    seedStore({ ...m, sets: [] });
    await renderRouter('./app', { initialUrl: '/match/m1/rotation' });
    expect(await screen.findByText('This match has no sets yet.')).toBeTruthy();
  });
});
