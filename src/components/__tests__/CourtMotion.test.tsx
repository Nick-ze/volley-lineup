import { act, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';

import { Court } from '@/components';
import type { SpotKeys } from '@/domain/courtMotion';
import { rotateBy } from '@/domain/rotation';

// `useReducedMotion` is a spy (jest.setup.ts), switched per test.
const reduceMotion = jest.mocked(Reanimated.useReducedMotion);

const start: SpotKeys = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: null };
const all = { includeHiddenElements: true };

function TestCourt({ keys }: { keys: SpotKeys }) {
  return (
    <Court
      slotKeys={keys}
      renderSlotStatic={({ position }) => <Text>{`#${position}`}</Text>}
      renderSlot={({ position }) => <Text testID={`who-${position}`}>{keys[position] ?? '-'}</Text>}
    />
  );
}

/** Lays the court out: two rows, slots 100 px wide. */
async function layOut() {
  const layout = (x: number, y: number) => ({
    nativeEvent: { layout: { x, y, width: 100, height: 110 } },
  });
  await act(async () => {
    screen.getByTestId('court-row-front').props.onLayout(layout(0, 20));
    screen.getByTestId('court-row-back').props.onLayout(layout(0, 150));
    for (const [p, i] of [
      [4, 0],
      [3, 1],
      [2, 2],
      [5, 0],
      [6, 1],
      [1, 2],
    ] as const) {
      screen.getByTestId(`court-slot-${p}`).props.onLayout(layout(i * 100, 0));
    }
  });
}

/** The slot's own content box (parent of the rendered content) is see-through while it slides. */
const hidden = (position: number) =>
  JSON.stringify(screen.getByTestId(`who-${position}`).parent?.props.style).includes('"opacity":0');
const ghosts = () => screen.queryByTestId('court-ghosts', all);

beforeEach(() => {
  jest.useFakeTimers();
  reduceMotion.mockReturnValue(false);
});
afterEach(() => jest.useRealTimers());

describe('Court motion', () => {
  it('slides every player and empty spot of a rotation, then shows the spots again', async () => {
    await render(<TestCourt keys={start} />);
    await layOut();
    await screen.rerender(<TestCourt keys={rotateBy(start, 1)} />);

    const layer = screen.getByTestId('court-ghosts', all);
    // Copies of all six spots slide over the court; the spots' numbers stay in the slots.
    expect(within(layer).getAllByText(/^[a-e-]$/, all)).toHaveLength(6);
    expect(within(layer).queryByText('#1', all)).toBeNull();
    expect(screen.getByTestId('who-1')).toHaveTextContent('b');
    expect(hidden(1)).toBe(true);

    await act(() => jest.advanceTimersByTime(400));
    expect(ghosts()).toBeNull();
    expect(hidden(1)).toBe(false);
  });

  it('does not slide without layout or for a swap (drag & drop)', async () => {
    await render(<TestCourt keys={start} />);
    await screen.rerender(<TestCourt keys={rotateBy(start, 1)} />);
    // Not laid out yet: no copies, nothing hidden.
    expect(ghosts()).toBeNull();
    expect(hidden(1)).toBe(false);

    await layOut();
    await screen.rerender(<TestCourt keys={{ ...rotateBy(start, 1), 1: 'c', 2: 'b' }} />);
    expect(ghosts()).toBeNull();
    expect(hidden(1)).toBe(false);
  });

  it('changes instantly with reduce motion', async () => {
    reduceMotion.mockReturnValue(true);
    await render(<TestCourt keys={start} />);
    await layOut();
    await screen.rerender(<TestCourt keys={rotateBy(start, 1)} />);
    expect(ghosts()).toBeNull();
    expect(screen.getByTestId('who-1')).toHaveTextContent('b');
    expect(hidden(1)).toBe(false);
  });
});
