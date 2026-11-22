import { Text } from 'react-native';

import { makeStyles, typography } from '@/theme';

export interface Status {
  tone: 'success' | 'error';
  text: string;
}

/** A one-line result message that screen readers announce. */
export function StatusMessage({ status, testID }: { status: Status | null; testID?: string }) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  text: { ...typography.body, color: theme.colors.text },
  error: { color: theme.colors.error },
}));
