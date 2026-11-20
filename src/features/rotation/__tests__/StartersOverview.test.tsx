// Must load before gesture-handler: it registers gesture-handler's and Reanimated's Jest mocks.
import { renderRouter } from 'expo-router/testing-library';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { useAppStore } from '@/store';

import { seedStore } from '../__fixtures__/seed';

// See RotationViewer.test.tsx: patch the `{}` Reanimated mock for gesture-handler v3 hooks.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const reanimatedMock: Record<string, unknown> = require('react-native-reanimated');
reanimatedMock.isSharedValue ??= () => false;

describe('starters overview', () => {
  beforeEach(() => seedStore());

  it('renders every set with its starting six, libero and serve info', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });

    const card1 = await screen.findByRole('button', { name: 'Set 1: open rotation viewer' });
    const card2 = screen.getByRole('button', { name: 'Set 2: open rotation viewer' });
    const card3 = screen.getByRole('button', { name: 'Set 3: open rotation viewer' });

    // Set 1: starting six in court layout (rotation 1, not rotated).
    expect(within(within(card1).getByTestId('court-slot-1')).getByText('1')).toBeTruthy();
    expect(within(within(card1).getByTestId('court-slot-4')).getByText('4')).toBeTruthy();
    expect(within(card1).getByTestId('libero-chip')).toBeTruthy();
    expect(within(card1).getByText('We serve first')).toBeTruthy();

    // Set 2: different start, no libero, receiving.
    expect(within(within(card2).getByTestId('court-slot-1')).getByText('2')).toBeTruthy();
    expect(within(card2).getByText('No libero')).toBeTruthy();
    expect(within(card2).getByText('We receive first')).toBeTruthy();

    // Set 3: empty.
    expect(within(card3).getByLabelText('Position 1, Back row: empty')).toBeTruthy();
  });

  it('tapping a set opens its rotation viewer', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Set 2: open rotation viewer' }),
    );
    expect(await screen.findByText('Rotation 1 of 6')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Show set 2' })).toBeSelected();
  });

  it('handles a missing match and a match without sets', async () => {
    await renderRouter('./app', { initialUrl: '/match/nope/starters' });
    expect(await screen.findByText('This match could not be found.')).toBeTruthy();
  });

  it('shows a message when the match has no sets', async () => {
    const m = useAppStore.getState().matches[0];
    seedStore({ ...m, sets: [] });
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });
    expect(await screen.findByText('This match has no sets yet.')).toBeTruthy();
  });
});
