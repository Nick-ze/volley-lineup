import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';

import { NoTabSwipe, SlideTransition, SwipeTabs } from '@/components';

// Spies on the animation helpers; `useReducedMotion` can be switched per test.
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

// v8.1.1: SwipeTabs renders every page with `renderTab` (no `children`), so the tab buttons sit
// beside it and each page holds its content.
function Tabs({ inner = false, blocked = false }: { inner?: boolean; blocked?: boolean }) {
  const [tab, setTab] = useState<Tab>('a');
  const content = (k: Tab) => <Text>{`content ${k}`}</Text>;
  const page = (k: Tab) => (
    <>
      {inner ? (
        <SwipeTabs tabs={TABS} value={k} onChange={setTab} renderTab={content} testID="inner" />
      ) : (
        content(k)
      )}
      {blocked && k === 'a' ? (
        <NoTabSwipe testID="table">
          <ScrollView horizontal>
            <Text>table</Text>
          </ScrollView>
        </NoTabSwipe>
      ) : null}
    </>
  );
  return (
    <>
      {TABS.map((k) => (
        <Text key={k} onPress={() => setTab(k)} testID={`tab-${k}`}>
          {k}
        </Text>
      ))}
      <SwipeTabs tabs={TABS} value={tab} onChange={setTab} renderTab={page} testID="outer" />
    </>
  );
}

const inRoot = (ui: React.ReactElement) => <GestureHandlerRootView>{ui}</GestureHandlerRootView>;

const swipe = (id: string, dx: number) =>
  act(() =>
    fireGestureHandler(getByGestureTestId(id), [
      { translationX: 0 },
      { translationX: dx / 2 },
      { translationX: dx },
    ]),
  );

beforeEach(() => {
  reduceMotion.mockReturnValue(false);
  withSequence.mockClear();
  withTiming.mockClear();
});

describe('SwipeTabs', () => {
  it('goes to the next tab on a swipe left and back on a swipe right, not past the ends', async () => {
    await render(inRoot(<Tabs />));
    await swipe('outer', 120);
    expect(screen.getByText('content a')).toBeTruthy();
    await swipe('outer', -120);
    expect(screen.getByText('content b')).toBeTruthy();
    await swipe('outer', -20); // too short
    expect(screen.getByText('content b')).toBeTruthy();
    await swipe('outer', -120);
    await swipe('outer', -120);
    expect(screen.getByText('content c')).toBeTruthy();
    await swipe('outer', 120);
    expect(screen.getByText('content b')).toBeTruthy();
  });

  it('still changes content on a tap, sliding it in', async () => {
    await render(inRoot(<Tabs />));
    await fireEvent.press(screen.getByTestId('tab-c'));
    expect(screen.getByText('content c')).toBeTruthy();
    // v8.1.1: the pager itself slides the pages (one shared position), not a SlideTransition.
    await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
    expect(withTiming).toHaveBeenCalledWith(2, expect.anything(), expect.any(Function));
    expect(withSequence).not.toHaveBeenCalled();
  });

  it('swipes only with the outer tabs when nested', async () => {
    await render(inRoot(<Tabs inner />));
    expect(() => getByGestureTestId('inner')).toThrow();
    await swipe('outer', -120);
    expect(screen.getByText('content b')).toBeTruthy();
  });

  it('ignores a swipe that started in a NoTabSwipe area', async () => {
    await render(inRoot(<Tabs blocked />));
    await act(() => fireGestureHandler(getByGestureTestId('table'), [{}, {}]));
    await swipe('outer', -120);
    expect(screen.getByText('content a')).toBeTruthy();
    // The next touch outside it swipes again.
    await swipe('outer', -120);
    expect(screen.getByText('content b')).toBeTruthy();
  });

  it('renders a NoTabSwipe child as it is outside any tabs', async () => {
    await render(
      <NoTabSwipe>
        <Text>alone</Text>
      </NoTabSwipe>,
    );
    expect(screen.getByText('alone')).toBeTruthy();
  });
});

describe('SlideTransition', () => {
  function Slide({ index, fromIndex }: { index: number; fromIndex?: number }) {
    return (
      <SlideTransition index={index} fromIndex={fromIndex} testID="slide">
        <Text>{`index ${index}`}</Text>
      </SlideTransition>
    );
  }

  it('slides when the index changes, not on the first render', async () => {
    await render(<Slide index={0} />);
    expect(withSequence).not.toHaveBeenCalled();
    await screen.rerender(<Slide index={2} />);
    expect(screen.getByText('index 2')).toBeTruthy();
    expect(withSequence).toHaveBeenCalled();
    fireEvent(screen.getByTestId('slide'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 100 } },
    });
  });

  it('slides in on mount from the index shown before (remounted content)', async () => {
    await render(<Slide index={2} fromIndex={1} />);
    expect(withSequence).toHaveBeenCalled();
  });

  it('changes instantly with reduce motion', async () => {
    reduceMotion.mockReturnValue(true);
    await render(<Slide index={0} />);
    await screen.rerender(<Slide index={1} />);
    expect(screen.getByText('index 1')).toBeTruthy();
    expect(withSequence).not.toHaveBeenCalled();
  });
});
