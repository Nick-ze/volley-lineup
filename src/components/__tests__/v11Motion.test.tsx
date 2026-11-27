import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { useReducedMotion, withSequence } from 'react-native-reanimated';

import { Scoreboard } from '@/features/live/Scoreboard';
import { darkColors } from '@/theme';

import { PRESS_SCALE, SPRING } from '../motion';
import { PillTabBar, type PillTabItem } from '../PillTabBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const flat = (node: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(node.props.style as object) ?? {}) as Record<string, unknown>;

afterEach(() => {
  jest.mocked(useReducedMotion).mockReturnValue(false);
  jest.mocked(withSequence).mockClear();
});

describe('press feedback (v11)', () => {
  it('a pressed control shrinks only a little', () => {
    expect(PRESS_SCALE).toBeGreaterThanOrEqual(0.95);
    expect(PRESS_SCALE).toBeLessThan(1);
  });

  it('the spring is the quick one with a slight overshoot', () => {
    expect(SPRING).toEqual({ stiffness: 380, damping: 31, mass: 1 });
  });
});

describe('PillTabBar marker (v11)', () => {
  const items: PillTabItem<'a' | 'b' | 'c'>[] = (['a', 'b', 'c'] as const).map((key) => ({
    key,
    label: key,
    icon: { active: 'people', inactive: 'people-outline' },
    testID: `tab-${key}`,
  }));
  const layout = (width: number) =>
    fireEvent(screen.getByTestId('bar'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width, height: 56 } },
    });

  it('once laid out, one marker as wide as an item carries the soft colour', async () => {
    await render(<PillTabBar items={items} value="b" onChange={() => {}} testID="bar" />);
    expect(screen.queryByTestId('bar-marker')).toBeNull();
    expect(flat(screen.getByTestId('tab-b')).backgroundColor).toBe(darkColors.primarySoft);

    await layout(308); // 300 for three items + 4 px padding on each side
    const marker = flat(screen.getByTestId('bar-marker'));
    expect(marker.width).toBe(100);
    expect(marker.backgroundColor).toBe(darkColors.primarySoft);
    // The item itself is plain now: the marker shows where it is.
    expect(flat(screen.getByTestId('tab-b')).backgroundColor).toBeUndefined();
    expect(screen.getByTestId('tab-b')).toBeSelected();
  });

  it('follows the active tab', async () => {
    const view = await render(
      <PillTabBar items={items} value="a" onChange={() => {}} testID="bar" />,
    );
    await layout(308);
    expect(flat(screen.getByTestId('bar-marker')).transform).toEqual([{ translateX: 0 }]);
    await view.rerender(<PillTabBar items={items} value="c" onChange={() => {}} testID="bar" />);
    // The Reanimated mock reads a shared value when the component renders (the real one follows
    // it on the UI thread), so render once more to see where the marker went.
    await view.rerender(<PillTabBar items={items} value="c" onChange={() => {}} testID="bar" />);
    expect(flat(screen.getByTestId('bar-marker')).transform).toEqual([{ translateX: 200 }]);
    expect(screen.getByTestId('tab-c')).toBeSelected();
  });
});

describe('Scoreboard tick (v11)', () => {
  const board = (us: number) => (
    <Scoreboard
      setNumber={1}
      opponent="Rivals"
      score={{ us, them: 4 }}
      setsWon={{ us: 0, them: 0 }}
      servingSide="us"
      serveText="We serve · #9"
      rotation={4}
    />
  );

  it('ticks when a score changes, not on the first draw', async () => {
    const view = await render(board(5));
    expect(screen.getByTestId('score-us')).toHaveTextContent('5');
    expect(withSequence).not.toHaveBeenCalled();
    await act(async () => {
      await view.rerender(board(6));
    });
    expect(screen.getByTestId('score-us')).toHaveTextContent('6');
    expect(withSequence).toHaveBeenCalledTimes(1);
  });

  it('does not move with "reduce motion"', async () => {
    jest.mocked(useReducedMotion).mockReturnValue(true);
    const view = await render(board(5));
    await act(async () => {
      await view.rerender(board(6));
    });
    expect(screen.getByTestId('score-us')).toHaveTextContent('6');
    expect(withSequence).not.toHaveBeenCalled();
  });

  it('the digits keep a fixed width', async () => {
    await render(board(5));
    expect(flat(screen.getByTestId('score-us')).fontVariant).toEqual(['tabular-nums']);
  });
});
