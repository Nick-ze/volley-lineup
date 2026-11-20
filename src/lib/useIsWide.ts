import { useWindowDimensions } from 'react-native';

import { wideBreakpoint } from '@/theme';

/** True on tablets / desktop browsers: court left, bench right. */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= wideBreakpoint;
}
