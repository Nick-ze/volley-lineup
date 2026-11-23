import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Reanimated from 'react-native-reanimated';

import { SwipeTabs } from '@/components';
import { SLIDE_DURATION_MS, TAB_COMMIT_FALLBACK_MS } from '@/domain/tabMotion';

/* v8.1 / v8.1.1: the interactive pager — the release rules (35 % of the width, a flick, the
 * ends) and, since v8.1.1, pages that stay mounted: the neighbours are there before a drag, and
 * neither a drag nor a tap remounts a page (the v8.1 flicker on Android). */

// Spies on the animation helpers (jest.setup.ts); `useReducedMotion` can be switched per test.
const reduceMotion = jest.mocked(Reanimated.useReducedMotion);
const withTiming = jest.mocked(Reanimated.withTiming);

const TABS = ['a', 'b', 'c', 'd', 'e'] as const;
type Tab = (typeof TABS)[number];
const WIDTH = 400;

/** How often each tab's page was mounted / unmounted. */
let mounts: Record<string, number> = {};
let unmounts: Record<string, number> = {};

function Page({ tab }: { tab: Tab }) {
  useEffect(() => {
    mounts[tab] = (mounts[tab] ?? 0) + 1;
    return () => {
      unmounts[tab] = (unmounts[tab] ?? 0) + 1;
    };
  }, [tab]);
  return <Text>{`page ${tab}`}</Text>;
}

function Pager({ start = 'b', onChange }: { start?: Tab; onChange?: (t: Tab) => void }) {
  const [tab, setTab] = useState<Tab>(start);
  return (
    <>
      {TABS.map((k) => (
        <Text key={k} testID={`tap-${k}`} onPress={() => setTab(k)}>
          {k}
        </Text>
      ))}
      <Text>{`value ${tab}`}</Text>
      <SwipeTabs
        tabs={TABS}
        value={tab}
        onChange={onChange ?? setTab}
        renderTab={(k) => <Page tab={k} />}
        testID="pager"
      />
    </>
  );
}

const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
/** A couple of frames (the neighbours mount a frame late; a tap's slide starts a frame late). */
const frames = () => wait(40);

async function setup(props: { start?: Tab; onChange?: (t: Tab) => void } = {}) {
  await render(
    <GestureHandlerRootView>
      <Pager {...props} />
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByTestId('pager-pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
  await frames();
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

/** The shown page (the others are hidden from accessibility, so plain queries skip them). */
const shown = (k: Tab) => screen.queryByText(`page ${k}`);
const mounted = (k: Tab) => screen.queryByText(`page ${k}`, { includeHiddenElements: true });

beforeEach(() => {
  mounts = {};
  unmounts = {};
  reduceMotion.mockReturnValue(false);
  withTiming.mockClear();
});

describe('interactive tab pager', () => {
  it('has the neighbours mounted (hidden) before any drag', async () => {
    await setup();
    expect(shown('b')).toBeTruthy();
    expect(shown('a')).toBeNull();
    expect(mounted('a')).toBeTruthy();
    expect(mounted('c')).toBeTruthy();
    expect(mounted('d')).toBeNull();
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('goes on past 35 % without remounting the new or the old page (no flicker)', async () => {
    await setup();
    await drag(-WIDTH * 0.4);
    expect(screen.getByText('value c')).toBeTruthy();
    expect(shown('c')).toBeTruthy();
    expect(shown('b')).toBeNull();
    await frames();
    // The page that was dragged in is the very same element: mounted once, never unmounted.
    expect(mounts).toMatchObject({ b: 1, c: 1, d: 1 });
    expect(unmounts.b).toBeUndefined();
    expect(unmounts.c).toBeUndefined();
    // Only the page now two tabs away goes (it is off screen).
    expect(unmounts.a).toBe(1);
    expect(withTiming).toHaveBeenCalledTimes(1);
  });

  it('goes to the previous tab when dragged right', async () => {
    await setup();
    await drag(WIDTH * 0.5);
    expect(shown('a')).toBeTruthy();
    expect(mounts.a).toBe(1);
  });

  it('goes back after a short drag', async () => {
    await setup();
    await drag(-WIDTH * 0.2);
    expect(screen.getByText('value b')).toBeTruthy();
    expect(shown('b')).toBeTruthy();
    expect(mounts).toEqual({ a: 1, b: 1, c: 1 });
  });

  it('goes on after a flick, back after a flick against the drag', async () => {
    await setup();
    await drag(WIDTH * 0.6, -900);
    expect(screen.getByText('value b')).toBeTruthy();
    await drag(-40, -900);
    expect(screen.getByText('value c')).toBeTruthy();
  });

  it('resists at the first tab and stays there', async () => {
    await setup({ start: 'a' });
    await drag(WIDTH * 0.6);
    expect(screen.getByText('value a')).toBeTruthy();
    expect(Object.keys(mounts).sort()).toEqual(['a', 'b']);
  });

  it('settles at once with reduce motion', async () => {
    reduceMotion.mockReturnValue(true);
    await setup();
    await drag(-WIDTH * 0.5);
    expect(screen.getByText('value c')).toBeTruthy();
    expect(withTiming).not.toHaveBeenCalled();
  });

  it('goes back if the parent never shows the dragged-to tab', async () => {
    const onChange = jest.fn();
    await setup({ onChange });
    await drag(-WIDTH * 0.5);
    expect(onChange).toHaveBeenCalledWith('c');
    await wait(TAB_COMMIT_FALLBACK_MS + 50);
    expect(shown('b')).toBeTruthy();
    expect(mounts).toEqual({ a: 1, b: 1, c: 1, d: 1 });
    expect(unmounts.b).toBeUndefined();
  });

  it('slides a tapped tab in without remounting it', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('tap-c'));
    expect(shown('c')).toBeTruthy();
    await frames();
    expect(withTiming).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ duration: SLIDE_DURATION_MS }),
      expect.any(Function),
    );
    expect(mounts.c).toBe(1);
    expect(unmounts.c).toBeUndefined();
  });

  it('jumps over tabs with a one-page slide, keeping the old page until it is off screen', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('tap-e'));
    expect(shown('e')).toBeTruthy();
    await frames();
    // The slide ran from right beside the target (d) to e.
    expect(withTiming).toHaveBeenLastCalledWith(4, expect.anything(), expect.any(Function));
    // b stayed mounted for the slide, then went.
    expect(mounts.b).toBe(1);
    expect(unmounts.b).toBe(1);
    expect(mounted('b')).toBeNull();
  });

  /** The next settle waits: returns the call that finishes it. */
  const holdSettle = () => {
    let finish: (done: boolean) => void = () => {};
    withTiming.mockImplementationOnce((to, _config, callback) => {
      finish = callback ?? finish;
      return to;
    });
    return () => act(() => finish(false));
  };

  it('keeps a tab tapped while a drag goes on to its neighbour', async () => {
    await setup();
    const finish = holdSettle();
    await drag(-WIDTH * 0.5);
    expect(screen.getByText('value b')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tap-a'));
    await frames();
    // The tap stopped the settle (Reanimated reports it unfinished): no change to c.
    await finish();
    expect(screen.getByText('value a')).toBeTruthy();
    expect(shown('a')).toBeTruthy();
  });

  it('runs a flick made while the last drag waits for its tab', async () => {
    const changes: Tab[] = [];
    // The parent shows the dragged-to tab only when told to (a slow screen).
    function Delayed() {
      const [tab, setTab] = useState<Tab>('a');
      return (
        <>
          <Text testID="show-b" onPress={() => setTab('b')}>
            b
          </Text>
          <SwipeTabs
            tabs={TABS}
            value={tab}
            onChange={(t) => changes.push(t)}
            renderTab={(k) => <Page tab={k} />}
            testID="pager"
          />
        </>
      );
    }
    await render(
      <GestureHandlerRootView>
        <Delayed />
      </GestureHandlerRootView>,
    );
    await frames();
    await drag(-WIDTH * 0.5);
    expect(changes).toEqual(['b']);
    await drag(-40, -900); // queued
    await fireEvent.press(screen.getByTestId('show-b'));
    await frames();
    expect(changes).toEqual(['b', 'c']);
  });
});
