import { StyleSheet, Text, View } from 'react-native';

import type { SetLineup } from '@/domain/types';
import { ToggleRow } from '@/components';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

export interface LiberoSwapControlProps {
  set: SetLineup;
  showSwaps: boolean;
  onChange: (value: boolean) => void;
}

/**
 * "Show libero swaps" on/off; a hint instead when nobody is chosen or the libero is switched off
 * for the set (v4). Hidden without a libero.
 */
export function LiberoSwapControl({ set, showSwaps, onChange }: LiberoSwapControlProps) {
  const t = useT();
  if (set.liberoId === null) return null;
  return (
    <View style={styles.box}>
      {!set.liberoActive ? (
        <Text style={styles.hint} testID="libero-off-note">
          {t.rotation.liberoOff}
        </Text>
      ) : set.liberoReplaces.length === 0 ? (
        <Text style={styles.hint}>{t.rotation.noLiberoReplaces}</Text>
      ) : (
        <ToggleRow
          label={t.rotation.showLiberoSwaps}
          value={showSwaps}
          onChange={onChange}
          testID="libero-swaps-toggle"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { ...typography.caption, color: colors.textMuted, paddingVertical: spacing.sm },
});
