import { useState } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { PrintChoiceDialog } from './PrintChoiceDialog';
import { usePrintSheet } from './usePrintSheet';

export interface PrintButtonProps {
  matchId: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Print / PDF": web opens the print dialog, phones get a PDF in the share sheet. Once the match
 * has results, pressing it first asks "Lineups only" / "With results".
 */
export function PrintButton({ matchId, style }: PrintButtonProps) {
  const t = useT();
  const { print, printing, failed, ready, hasResults } = usePrintSheet(matchId);
  const [choosing, setChoosing] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      <Button
        label={t.print.button}
        accessibilityLabel={t.print.buttonLabel}
        variant="secondary"
        compact
        disabled={!ready || printing}
        onPress={() => (hasResults ? setChoosing(true) : void print())}
        testID="print-sheet"
      />
      {choosing ? (
        <PrintChoiceDialog
          onChoose={(withResults) => {
            setChoosing(false);
            void print({ withResults });
          }}
          onCancel={() => setChoosing(false)}
        />
      ) : null}
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
