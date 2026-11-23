import { Stack } from 'expo-router';
import { useMemo } from 'react';

/**
 * v8.3: `<Stack.Screen options={{ title }} />` with the options object kept while the title is
 * the same. expo-router calls `navigation.setOptions` (and re-renders the navigator) whenever the
 * options object changes, so a fresh literal did that on every render of the screen.
 */
export function ScreenTitle({ title }: { title: string }) {
  const options = useMemo(() => ({ title }), [title]);
  return <Stack.Screen options={options} />;
}
