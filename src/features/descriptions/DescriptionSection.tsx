import { StyleSheet, Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import { DescriptionEditor } from './DescriptionEditor';
import { DescriptionLockBar } from './DescriptionLockBar';
import { useDescriptionLock } from './descriptionLock';

/** The player detail's description card: locked → only "Show descriptions"; unlocked → editor. */
export function DescriptionSection({ player }: { player: Player }) {
  const t = useT();
  const s = t.playerDetail.description;
  const unlocked = useDescriptionLock((x) => x.unlocked);
  return (
    <View style={styles.card} testID="description-section">
      <Text style={listStyles.title} accessibilityRole="header">
        {s.heading}
      </Text>
      <Text style={styles.hint}>{s.hint}</Text>
      {unlocked ? <DescriptionEditor key={player.id} player={player} /> : null}
      <DescriptionLockBar />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  hint: { ...typography.caption, color: colors.textMuted },
});
