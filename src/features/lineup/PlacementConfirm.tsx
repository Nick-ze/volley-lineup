import { Modal, Text, View } from 'react-native';

import { fullName } from '@/domain/playerNames';
import { Button } from '@/components';
import { useT } from '@/i18n';
import { dialogMaxWidth, makeStyles, radius, spacing, typography } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

/**
 * "Are you sure?" before a drag & drop / tap-to-select move or a formation change puts a player
 * on a spot whose role is none of their positions (one line per player, e.g. both players of a
 * swap). Cancel changes nothing; Confirm makes the change (the spot then shows "*").
 */
export function PlacementConfirm({ editor }: { editor: LineupDraft }) {
  const styles = useStyles();
  const t = useT();
  const s = t.roles.confirm;
  const { pending, pendingKind, playerById, confirmPending, cancelPending } = editor;
  const lines = (pending ?? []).map((p) => {
    const player = playerById(p.playerId);
    const name = player ? t.roles.playerRef(player.number, fullName(player)) : '';
    return s.notListed(name, t.positions[p.role]);
  });

  return (
    <Modal
      visible={pending !== null}
      transparent
      animationType="fade"
      onRequestClose={cancelPending}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal testID="placement-confirm">
          <Text style={styles.title} accessibilityRole="header">
            {s.title}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={styles.message}>
              {line}
            </Text>
          ))}
          <Text style={styles.message}>
            {pendingKind === 'formation'
              ? s.questionFormation
              : lines.length > 1
                ? s.questionMany
                : s.questionOne}
          </Text>
          <View style={styles.actions}>
            <Button
              label={s.cancel}
              accessibilityLabel={s.cancelLabel}
              variant="secondary"
              onPress={cancelPending}
              testID="placement-cancel"
            />
            <Button
              label={s.confirm}
              accessibilityLabel={
                pendingKind === 'formation' ? s.confirmFormationLabel : s.confirmLabel
              }
              onPress={confirmPending}
              testID="placement-confirm-button"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: theme.colors.text },
  message: { ...typography.body, color: theme.colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
}));
