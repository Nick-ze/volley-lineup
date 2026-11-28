import { useSegments } from 'expo-router';
import { createContext, useState } from 'react';

import type { TabPager } from '@/components';

/** The tabs in bar order (v8: swipe left → the next one). */
export const APP_TABS = ['teams', 'tournaments', 'profile', 'settings'] as const;
export type AppTab = (typeof APP_TABS)[number];

export const isAppTab = (name: string | undefined): name is AppTab =>
  APP_TABS.some((tab) => tab === name);

/** The app tab shown (the last one while a detail screen is pushed over the tabs). */
export function useShownTab(): AppTab {
  // Expo Router types the segments per route (tuples of different lengths); only the first two
  // matter here.
  const [group, name] = useSegments() as string[];
  const current = group === '(tabs)' && isAppTab(name) ? name : null;
  const [last, setLast] = useState<AppTab>(current ?? 'teams');
  if (current && current !== last) setLast(current);
  return current ?? last;
}

/** v8.1.1: the pager all the tab scenes share. */
export const AppTabPagerContext = createContext<TabPager | null>(null);
