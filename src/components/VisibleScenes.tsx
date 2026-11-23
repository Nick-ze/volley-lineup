import { forwardRef, type ComponentRef, type ReactNode } from 'react';
import { View } from 'react-native';
import { ScreenContext, type ScreenProps } from 'react-native-screens';

/**
 * v8.1.1: a react-native-screens `Screen` that is a plain View. The navigator's own `Screen`
 * hides an inactive scene (`display: 'none'` with detaching off, a detached native view with it
 * on), so a pager could never show the neighbouring scene beside the current one on a phone.
 * This one ignores the activity props; the pager decides where (and whether) a scene shows, and
 * the navigator still hides unfocused scenes from touch and assistive tech.
 */
const PlainScreen = forwardRef<ComponentRef<typeof View>, ScreenProps>(function PlainScreen(
  { style, pointerEvents, testID, children },
  ref,
) {
  return (
    <View ref={ref} style={style} pointerEvents={pointerEvents} testID={testID}>
      {children}
    </View>
  );
});

/** Every react-native-screens `Screen` inside (the app tab bar's scenes) stays a visible View. */
export function VisibleScenes({ children }: { children: ReactNode }) {
  return <ScreenContext.Provider value={PlainScreen}>{children}</ScreenContext.Provider>;
}
