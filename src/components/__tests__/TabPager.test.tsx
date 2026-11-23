import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';

import { SwipeTabs } from '@/components';
import { TAB_COMMIT_FALLBACK_MS } from '@/domain/tabMotion';

/* v8.1: the interactive pager — the neighbouring tab beside the dragged one, the release rules
 * (a third of the width, a flick, the ends) and the hand-over to the new tab. */

jest.mock('react-native-reanimated', () => {
  const mock = jest.requireActual('react-native-reanimated/mock');
  return {
    ...mock,
    useReducedMotion: jest.fn(() => false),
    withSequence: jest.fn(mock.withSequence),
    withTiming: jest.fn(mock.withTiming),
  };
});
const reduceMotion = Reanimated.useReducedMotion as jest.Mock;
const withSequence = Reanimated.withSequence as jest.Mock;
const withTiming = Reanimated.withTiming as jest.Mock;

const TABS = ['a', 'b', 'c'] as const;
type Tab = (typeof TABS)[number];
const WIDTH = 400;

const renderTab = jest.fn((k: Tab) => <Text>{`page ${k}`}</Text>);

function Pager({ start = 'b', onChange }: { start?: Tab; onChange?: (t: Tab) => void }) {
  const [tab, setTab] = useState<Tab>(start);
  return (
    <SwipeTabs
      tabs={TABS}
      value={tab}
      onChange={onChange ?? setTab}
      renderTab={renderTab}
      testID="pager"
    >
      <Text>{`current ${tab}`}</Text>
    </SwipeTabs>
  );
}

async function setup(props: { start?: Tab; onChange?: (t: Tab) => void } = {}) {
  await render(
    <GestureHandlerRootView>
      <Pager {...props} />
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByTestId('pager-pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
}

/** A drag by `dx`, released at `velocityX` (px/s). */
const drag = (dx: number, velocityX = 0) =>
  act(() =>
    fireGestureHandler(getByGestureTestId('pager'), [
      { translationX: 0, velocityX: 0 },
      { translationX: dx / 2, velocityX },
      { translationX: dx, velocityX },
    ]),
  );

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
// The neighbour is hidden from accessibility (a copy), so the query must include hidden elements.
const neighbour = () => screen.queryByTestId('pager-neighbour', { includeHiddenElements: true });

beforeEach(() => {
  reduceMotion.mockReturnValue(false);
  renderTab.mockClear();
  withSequence.mockClear();
  withTiming.mockClear();
});

describe('interactive tab pager', () => {
  it('shows the next tab beside the page while dragging and goes on past a third', async () => {
    await setup();
    await drag(-WIDTH * 0.4);
    // The neighbour was rendered for the drag (lazily: only the one in the drag direction).
    expect(renderTab.mock.calls.map(([k]) => k)).toEqual(expect.arrayContaining(['c']));
    expect(renderTab.mock.calls.some(([k]) => k === 'a')).toBe(false);
    expect(screen.getByText('current c')).toBeTruthy();
    // The settled copy stays until the new tab is in place, then goes; no second slide.
    expect(neighbour()).toBeTruthy();
    await wait(50);
    expect(neighbour()).toBeNull();
    expect(withSequence).not.toHaveBeenCalled();
    expect(withTiming).toHaveBeenCalledTimes(1);
  });

  it('shows the previous tab when dragging right', async () => {
    await setup();
    await drag(WIDTH * 0.5);
    expect(renderTab.mock.calls.map(([k]) => k)).toContain('a');
    expect(screen.getByText('current a')).toBeTruthy();
  });

  it('goes back after a short drag and drops the neighbour', async () => {
    await setup();
    await drag(-WIDTH * 0.2);
    expect(screen.getByText('current b')).toBeTruthy();
    expect(neighbour()).toBeNull();
  });

  it('goes on after a flick, back after a flick against the drag', async () => {
    await setup();
    await drag(WIDTH * 0.6, -900);
    expect(screen.getByText('current b')).toBeTruthy();
    await drag(-40, -900);
    expect(screen.getByText('current c')).toBeTruthy();
  });

  it('resists at the first tab and stays there, without a neighbour', async () => {
    await setup({ start: 'a' });
    await drag(WIDTH * 0.6);
    expect(renderTab).not.toHaveBeenCalled();
    expect(neighbour()).toBeNull();
    expect(screen.getByText('current a')).toBeTruthy();
  });

  it('settles at once with reduce motion', async () => {
    reduceMotion.mockReturnValue(true);
    await setup();
    await drag(-WIDTH * 0.5);
    expect(screen.getByText('current c')).toBeTruthy();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('resets if the screen itself does not change tab (another screen shows it)', async () => {
    const onChange = jest.fn();
    await setup({ onChange });
    await drag(-WIDTH * 0.5);
    expect(onChange).toHaveBeenCalledWith('c');
    expect(neighbour()).toBeTruthy();
    await wait(TAB_COMMIT_FALLBACK_MS + 50);
    expect(neighbour()).toBeNull();
    expect(screen.getByText('current b')).toBeTruthy();
  });
});
