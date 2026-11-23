import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { NoTabSwipe, SwipeTabs } from '@/components';

/* v8.3 (AUDIT A3): RNGH rebuilds a hook gesture (native config, shared values, handlers) whenever
 * its config object changes, so the pager's pan and the `NoTabSwipe` gesture keep their config —
 * and so the same gesture — when the screen re-renders for something else. */

const TABS = ['a', 'b', 'c'] as const;
type Tab = (typeof TABS)[number];

function Screen() {
  const [tab, setTab] = useState<Tab>('b');
  const [count, setCount] = useState(0);
  return (
    <GestureHandlerRootView>
      <Text testID="bump" onPress={() => setCount((n) => n + 1)}>
        {`renders ${count}`}
      </Text>
      <SwipeTabs
        tabs={TABS}
        value={tab}
        onChange={setTab}
        renderTab={(k) => (
          <NoTabSwipe testID={`block-${k}`}>
            <Text>{`page ${k} ${count}`}</Text>
          </NoTabSwipe>
        )}
        testID="pager"
      />
    </GestureHandlerRootView>
  );
}

describe('gesture configs', () => {
  it('stay the same object across unrelated re-renders', async () => {
    await render(<Screen />);
    const pan = getByGestureTestId('pager');
    const block = getByGestureTestId('block-b');
    await fireEvent.press(screen.getByTestId('bump'));
    await fireEvent.press(screen.getByTestId('bump'));
    expect(screen.getByText('page b 2')).toBeTruthy();
    expect(getByGestureTestId('pager')).toBe(pan);
    expect(getByGestureTestId('block-b')).toBe(block);
  });
});
