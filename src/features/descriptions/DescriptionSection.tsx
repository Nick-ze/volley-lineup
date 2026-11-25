import { Text, View } from 'react-native';

import { useListStyles } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { useCanEdit } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { DescriptionEditor } from './DescriptionEditor';
import { DescriptionLockBar } from './DescriptionLockBar';
import { useDescriptionLock } from './descriptionLock';

/**
 * The player detail's description card: locked → only "Show descriptions"; unlocked → editor.
 * v10: hidden for view-only members of a shared team (descriptions are the managers' notes).
 */
export function DescriptionSection({ player }: { player: Player }) {
  const styles = useStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.playerDetail.description;
  const unlocked = useDescriptionLock((x) => x.unlocked);
  const canEdit = useCanEdit(player.teamId);
  if (!canEdit) return null;
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

const useStyles = makeStyles((theme) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  hint: { ...typography.caption, color: theme.colors.textMuted },
}));
