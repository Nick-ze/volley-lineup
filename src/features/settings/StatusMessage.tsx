import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme';

export interface Status {
  tone: 'success' | 'error';
  text: string;
}

/** A one-line result message that screen readers announce. */
export function StatusMessage({ status, testID }: { status: Status | null; testID?: string }) {
  if (!status) return null;
  const isError = status.tone === 'error';
  return (
    <Text
      testID={testID}
      accessibilityRole={isError ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.text, isError && styles.error]}
    >
      {status.text}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { ...typography.body, color: colors.text },
  error: { color: colors.error },
});
