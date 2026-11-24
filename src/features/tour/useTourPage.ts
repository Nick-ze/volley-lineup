import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import type { TourPage } from '@/domain/types';

import { blurTourPage, focusTourPage } from './tourSession';

/**
 * v9.0: the screen's tour page. Call it ONCE per screen, at screen level, with the page of the
 * shown tab (null: no tips, e.g. "not found"). It only acts while the screen has focus, so screens
 * under another one and pager neighbours (kept mounted beside the shown tab) never show tips —
 * never call it inside tab content.
 */
export function useTourPage(page: TourPage | null): void {
  useFocusEffect(
    useCallback(() => {
      if (page === null) return undefined;
      focusTourPage(page);
      return () => blurTourPage(page);
    }, [page]),
  );
}
