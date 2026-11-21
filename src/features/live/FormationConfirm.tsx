import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, dialogMaxWidth, radius, spacing, typography } from '@/theme';

import { playerRef } from './format';
import type { PendingFormation } from './useSetupDraft';

export interface FormationConfirmProps {
  /** The formation change waiting for confirmation, or null (dialog hidden). */
  change: PendingFormation | null;
  playersById: Map<string, Player>;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Are you sure?" before a formation change in the next-set setup puts starters onto roles that
 * are none of their positions (v5, as when placing a player in the builder). Cancel keeps the
 * old formation.
 */
export function FormationConfirm({
  change,
  playersById,
  onConfirm,
  onCancel,
}: FormationConfirmProps) {
  const t = useT();
  const s = t.live.setup;
  const list = (change?.offPosition ?? [])
    .map((o) => s.formationOffAs(playerRef(t, playersById, o.playerId), t.positions[o.role]))
    .join(', ');
  return (
    <Modal visible={change !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal testID="formation-confirm">
          <Text style={styles.title} accessibilityRole="header">
            {s.formationOffTitle}
          </Text>
          <Text style={styles.message}>{s.formationOff(list)}</Text>
          <View style={styles.actions}>
            <Button
              label={t.common.cancel}
              accessibilityLabel={s.formationCancelLabel}
              variant="secondary"
              onPress={onCancel}
              testID="formation-cancel"
            />
            <Button
              label={s.formationConfirm}
              accessibilityLabel={s.formationConfirmLabel}
              onPress={onConfirm}
              testID="formation-confirm-ok"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: colors.text },
  message: { ...typography.body, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm },
});
