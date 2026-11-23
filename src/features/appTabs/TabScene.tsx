import { useContext, type ReactElement } from 'react';

import { PagerScene } from '@/components';

import { APP_TABS, AppTabPagerContext, isAppTab } from './appTabs';

/**
 * v8: a sideways swipe on a tab screen goes to the neighbouring tab. v8.1.1: the real screens
 * follow the finger (every scene stays mounted, at its slot for the shared pager position); a
 * drag that goes on navigates once the new screen is in place, and a tap or Back slides there.
 */
export function TabScene({ name, children }: { name: string; children: ReactElement }) {
  const pager = useContext(AppTabPagerContext);
  if (!pager || !isAppTab(name)) return children;
  return (
    <PagerScene
      pager={pager}
      index={APP_TABS.indexOf(name)}
      count={APP_TABS.length}
      testID={`app-tab-swipe-${name}`}
    >
      {children}
    </PagerScene>
  );
}
