import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { UnlockDialog } from './UnlockDialog';
import { useUnlockDescriptions } from './useUnlockDescriptions';

/**
 * "Show descriptions" while locked (no text, no hint whether any exist), "Lock" while unlocked.
 * Used on the player detail screen and in Settings → Export.
 */
export function DescriptionLockBar() {
  const t = useT();
  const s = t.playerDetail.description;
  const { unlocked, busy, failed, requestUnlock, lock, confirmVisible, confirm, cancel } =
    useUnlockDescriptions();

  return (
    <View style={styles.wrap}>
      {unlocked ? (
        <View style={styles.row}>
          <Text style={styles.note}>{s.unlockedNote}</Text>
          <Button
            label={s.lock}
            accessibilityLabel={s.lockLabel}
            variant="secondary"
            compact
            onPress={lock}
            testID="descriptions-lock"
          />
        </View>
      ) : (
        <Button
          label={s.show}
          accessibilityLabel={s.showLabel}
          variant="secondary"
          onPress={() => void requestUnlock()}
          disabled={busy}
          testID="descriptions-show"
        />
      )}
      {failed ? (
        <Text style={styles.failed} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {s.failed}
        </Text>
      ) : null}
      <UnlockDialog visible={confirmVisible} onConfirm={confirm} onCancel={cancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, flex: 1 },
  failed: { ...typography.label, color: colors.error },
});
