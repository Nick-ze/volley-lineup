import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Goes back if there is history (e.g. closing a modal), otherwise replaces with `fallback`. */
export function useGoBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
