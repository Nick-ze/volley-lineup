import { useState } from 'react';
import { type StyleProp, Text, View, type ViewStyle } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { PrintChoiceDialog, type PrintChoice } from './PrintChoiceDialog';
import { usePrintSheet } from './usePrintSheet';
import { useScorerSheet } from './useScorerSheet';

export interface PrintButtonProps {
  matchId: string;
  /** Layout of the wrapper (button + error line). */
  style?: StyleProp<ViewStyle>;
  /** Style of the button itself (e.g. the match screen's link padding). */
  buttonStyle?: StyleProp<ViewStyle>;
}

/**
 * "Print / PDF": web opens the print dialog, phones get a PDF in the share sheet. Pressing it
 * first asks what to print: the lineup sheet ("With results" / "Lineups only" once the match has
 * results) or (v9.2) the player list for the scorer.
 */
export function PrintButton({ matchId, style, buttonStyle }: PrintButtonProps) {
  const styles = useStyles();
  const t = useT();
  const sheet = usePrintSheet(matchId);
  const scorer = useScorerSheet({ matchId });
  const [choosing, setChoosing] = useState(false);
  const choose = (choice: PrintChoice) => {
    setChoosing(false);
    if (choice === 'scorer') void scorer.print();
    else void sheet.print({ withResults: choice === 'results' });
  };
  return (
    <View style={[styles.wrap, style]}>
      <Button
        label={t.print.button}
        accessibilityLabel={t.print.buttonLabel}
        variant="secondary"
        compact
        disabled={!sheet.ready || sheet.printing || scorer.printing}
        onPress={() => setChoosing(true)}
        style={buttonStyle}
        testID="print-sheet"
      />
      {choosing ? (
        <PrintChoiceDialog
          hasResults={sheet.hasResults}
          onChoose={choose}
          onCancel={() => setChoosing(false)}
        />
      ) : null}
      {sheet.failed || scorer.failed ? (
        <Text accessibilityRole="alert" style={styles.error} testID="print-error">
          {t.print.failed}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  error: { ...typography.body, color: theme.colors.error },
}));
