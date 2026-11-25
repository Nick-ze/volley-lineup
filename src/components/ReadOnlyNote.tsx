import { Text, View } from 'react-native';

import { useT } from '@/i18n';
import type { EditBlock } from '@/domain/syncAccess';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { Button } from './Button';

export interface ReadOnlyNoteProps {
  /** Why this can't be edited (from `useTeamAccess` / `useMatchAccess`); null renders nothing. */
  block: EditBlock;
  /** With 'held': the name of whoever scores the match live. */
  holder?: string;
  /** With 'held': shows "Take over" (managers only). */
  onTakeOver?: () => void;
}

/**
 * v10: a short line saying why controls are missing — a view-only member (player role) or a
 * match being scored live on another device — with "Take over" for a held match.
 */
export function ReadOnlyNote({ block, holder = '', onTakeOver }: ReadOnlyNoteProps) {
  const t = useT();
  const styles = useStyles();
  if (!block) return null;
  const text = block === 'held' ? t.sync.readOnly.held(holder) : t.sync.readOnly.viewer;
  return (
    <View style={styles.box} testID="read-only-note">
      <Text style={styles.text}>{text}</Text>
      {block === 'held' && onTakeOver ? (
        <Button label={t.sync.readOnly.takeOver} onPress={onTakeOver} variant="secondary" compact />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  text: { ...typography.body, color: theme.colors.text, flexShrink: 1 },
}));
