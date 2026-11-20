import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme';

/** A centred status line for missing data (match not found, no sets). */
export function Message({ text }: { text: string }) {
  return (
    <Text style={styles.message} accessibilityRole="alert">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
});
