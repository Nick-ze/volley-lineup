import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import type { SetNumber } from '@/domain/types';

/**
 * When the `?set=` param doesn't match the set actually shown (missing, invalid or non-existent
 * set → first set), rewrite the URL to the shown set. useFocusEffect (not useEffect): params can
 * only be set once the navigator has mounted.
 */
export function useCorrectSetParam(
  setParam: string | string[] | undefined,
  shown: SetNumber | undefined,
  setSetParam: (set: SetNumber) => void,
): void {
  useFocusEffect(
    useCallback(() => {
      if (shown !== undefined && setParam !== String(shown)) setSetParam(shown);
    }, [setParam, shown, setSetParam]),
  );
}
