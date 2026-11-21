import { renderRouter } from 'expo-router/testing-library';
import { fireEvent, screen, within } from '@testing-library/react-native';

import { useAppStore } from '@/store';

import { seedStore } from '../__fixtures__/seed';

describe('starters overview', () => {
  beforeEach(() => seedStore());

  it('renders every set with its starting six, libero and serve info', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });

    const card1 = await screen.findByRole('button', { name: /^Set 1: open rotation viewer/ });
    const card2 = screen.getByRole('button', { name: /^Set 2: open rotation viewer/ });
    const card3 = screen.getByRole('button', { name: /^Set 3: open rotation viewer/ });

    // Set 1: starting six in court layout (rotation 1, not rotated).
    expect(within(within(card1).getByTestId('court-slot-1')).getByText('1')).toBeTruthy();
    expect(within(within(card1).getByTestId('court-slot-4')).getByText('4')).toBeTruthy();
    expect(within(card1).getByTestId('libero-chip')).toBeTruthy();
    expect(within(card1).getByText('We serve first')).toBeTruthy();

    // Set 2: different start, no libero, receiving.
    expect(within(within(card2).getByTestId('court-slot-1')).getByText('2')).toBeTruthy();
    expect(within(card2).getByText('No libero')).toBeTruthy();
    expect(within(card2).getByText('We receive first')).toBeTruthy();

    // The card is one button, so its label must summarise what it shows.
    // v4: with each starter's role and the rotation named after the setter.
    expect(card1.props.accessibilityLabel).toBe(
      'Set 1: open rotation viewer. Starters: position 1 number 1 S Setter, plays Setter, ' +
        'position 2 number 2 O Outside, plays Outside Hitter, ' +
        'position 3 number 3 M Middle, plays Middle Blocker, ' +
        'position 4 number 4 O Oppo, plays Opposite, ' +
        'position 5 number 5 W Wing, plays Outside Hitter, ' +
        'position 6 number 6 B Block, plays Middle Blocker. Libero: number 7 D Dig. ' +
        'We serve first. Rotation 1 (setter on\u00a01).',
    );
    expect(card2.props.accessibilityLabel).toMatch(
      /Libero: No libero\. We receive first\. Rotation 6 \(setter on 6\)\.$/,
    );
    expect(card3.props.accessibilityLabel).toMatch(/position 1 empty/);

    // Set 3: empty.
    expect(within(card3).getByLabelText('Position 1, Back row: empty')).toBeTruthy();
  });

  it('tapping a set opens its rotation viewer', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/starters' });
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Set 2: open rotation viewer/ }),
    );
    // Set 2 starts with the setter at 6.
    expect(await screen.findByText('Rotation 6 (setter on\u00a06)')).toBeTruthy();
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
