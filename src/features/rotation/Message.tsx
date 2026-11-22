import { Text } from 'react-native';

import { makeStyles, typography } from '@/theme';

/** A centred status line for missing data (match not found, no sets). */
export function Message({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <Text style={styles.message} accessibilityRole="alert">
      {text}
    </Text>
  );
}

const useStyles = makeStyles((theme) => ({
  message: { ...typography.body, color: theme.colors.textMuted, textAlign: 'center' },
}));
