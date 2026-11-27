import { View } from 'react-native';

import { Button, IconButton } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

export interface MatchHeaderButtonsProps {
  /** Open live scoring. */
  onLive: () => void;
  /** Ask what to print. */
  onPrint: () => void;
  printDisabled: boolean;
}

/**
 * v11: the match screen's header buttons (DECISIONS #340): "Live" — the one main action of the
 * screen, always in reach — and Print / PDF as an icon beside it.
 */
export function MatchHeaderButtons({ onLive, onPrint, printDisabled }: MatchHeaderButtonsProps) {
  const styles = useStyles();
  const t = useT();
  return (
    <View style={styles.row}>
      <IconButton
        icon="print-outline"
        accessibilityLabel={t.print.buttonLabel}
        disabled={printDisabled}
        onPress={onPrint}
        testID="print-sheet"
      />
      <Button
        label={t.live.open}
        accessibilityLabel={t.live.openLabel}
        compact
        onPress={onLive}
        testID="open-live"
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
}));
