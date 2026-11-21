import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { match, seedStore, set1 } from '../__fixtures__/seed';

const spot = (position: number) =>
  within(screen.getByTestId(`court-slot-${position}`)).getByTestId(`spot-${position}`);
const numberAt = (position: number, num: string) =>
  expect(within(spot(position)).getByText(num)).toBeTruthy();

// The tag is decorative (hidden from screen readers; the spot's label says the same).
const hidden = { includeHiddenElements: true };
const tag = (id: string) => screen.getByTestId(id, hidden);

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next rotation' }));

describe('rotation viewer — libero swaps', () => {
  beforeEach(() =>
    seedStore({ ...match, sets: [{ ...set1, liberoReplaces: ['p3', 'p6'] }, match.sets[1]] }),
  );

  it('shows the libero in the middles’ back-row spots, never at the serving position 1', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter at position 1)');

    // Rotation 1: middle #6 is at position 6 → libero #7 is in for them.
    numberAt(6, '7');
    expect(tag('libero-tag-6')).toHaveTextContent('L for #6');
    expect(
      screen.getByLabelText(/^Position 6, Back row: Libero Number 7,.*in for number 6/),
    ).toBeTruthy();
    numberAt(3, '3');

    // Rotation 2: #6 moved to 5.
    await next();
    numberAt(5, '7');
    expect(tag('libero-tag-5')).toHaveTextContent('L for #6');

    // Rotation 3: middle #3 serves at position 1 → no libero on court.
    await next();
    numberAt(1, '3');
    expect(screen.queryByTestId(/^libero-tag-/, hidden)).toBeNull();

    // Rotation 4: #3 moved to 6.
    await next();
    numberAt(6, '7');
    expect(tag('libero-tag-6')).toHaveTextContent('L for #3');
  });

  it('the toggle shows the base lineup without swaps', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter at position 1)');
    const toggle = screen.getByRole('switch', { name: 'Show libero swaps' });
    expect(toggle).toBeChecked();

    await fireEvent.press(toggle);
    numberAt(6, '6');
    expect(screen.queryByTestId('libero-tag-6', hidden)).toBeNull();

    await fireEvent.press(toggle);
    numberAt(6, '7');
  });

  it('asks to choose whom the libero replaces when nobody is chosen', async () => {
    seedStore();
    await renderRouter('./app', { initialUrl: '/match/m1/rotation?set=1' });
    await screen.findByText('Rotation 1 (setter at position 1)');
    expect(screen.getByText(/Choose whom the libero replaces/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    numberAt(6, '6');
  });
});
