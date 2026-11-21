import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components';
import { t } from '@/i18n/en';
import { colors, spacing, typography } from '@/theme';

import { usePrintSheet } from './usePrintSheet';

export interface PrintButtonProps {
  matchId: string;
  style?: StyleProp<ViewStyle>;
}

/** "Print / PDF": web opens the print dialog, phones get a PDF in the share sheet. */
export function PrintButton({ matchId, style }: PrintButtonProps) {
  const { print, printing, failed, ready } = usePrintSheet(matchId);
  return (
    <View style={[styles.wrap, style]}>
      <Button
        label={t.print.button}
        accessibilityLabel={t.print.buttonLabel}
        variant="secondary"
        compact
        disabled={!ready || printing}
        onPress={() => void print()}
        testID="print-sheet"
      />
      {failed ? (
        <Text accessibilityRole="alert" style={styles.error} testID="print-error">
          {t.print.failed}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  error: { ...typography.body, color: colors.error },
});
