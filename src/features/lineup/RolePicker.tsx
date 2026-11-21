import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { COURT_ROLES, isOffPosition } from '@/domain/roles';
import type { Player, Position } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, dialogMaxWidth, radius, spacing, touchTarget, typography } from '@/theme';

export interface RolePickerProps {
  player: Player;
  /** The role the player plays now. */
  current: Position | null;
  /** Called with the chosen role (already confirmed when it is none of the player's positions). */
  onPick: (role: Position) => void;
  onClose: () => void;
}

/**
 * In-app role choice for one starter (S, OH, MB, OPP, DS). A role that is none of the player's
 * positions asks "Are you sure?" first; Cancel keeps the old role. Mount it to show it.
 */
export function RolePicker({ player, current, onPick, onClose }: RolePickerProps) {
  const t = useT();
  const s = t.roles;
  const [pending, setPending] = useState<Position | null>(null);
  const name = s.playerRef(player.number, `${player.firstName} ${player.lastName}`.trim());

  const choose = (role: Position) => {
    if (role === current) onClose();
    else if (isOffPosition(player, role)) setPending(role);
    else onPick(role);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {pending ? (
          <View style={styles.card} accessibilityViewIsModal testID="role-confirm">
            <Text style={styles.title} accessibilityRole="header">
              {s.confirm.title}
            </Text>
            <Text style={styles.message}>{s.confirm.message(name, t.positions[pending])}</Text>
            <View style={styles.actions}>
              <Button
                label={t.common.cancel}
                variant="secondary"
                onPress={onClose}
                testID="role-confirm-cancel"
              />
              <Button
                label={s.confirm.confirm}
                accessibilityLabel={s.confirm.confirmLabel(t.positions[pending])}
                onPress={() => onPick(pending)}
                testID="role-confirm-ok"
              />
            </View>
          </View>
        ) : (
          <View style={styles.card} accessibilityViewIsModal testID="role-picker">
            <Text style={styles.title} accessibilityRole="header">
              {s.picker.title(name)}
            </Text>
            <Text style={styles.hint}>{s.picker.hint}</Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {COURT_ROLES.map((role) => {
                const checked = role === current;
                const off = isOffPosition(player, role);
                return (
                  <Pressable
                    key={role}
                    accessibilityRole="radio"
                    accessibilityLabel={s.picker.optionLabel(role, t.positions[role], off)}
                    accessibilityState={{ checked }}
                    aria-checked={checked}
                    onPress={() => choose(role)}
                    style={({ pressed }) => [
                      styles.option,
                      checked && styles.checked,
                      pressed && styles.pressed,
                    ]}
                    testID={`role-option-${role}`}
                  >
                    <Text style={[styles.optionText, checked && styles.checkedText]}>
                      {s.picker.optionText(role, t.positions[role])}
                      {off ? s.picker.offMark : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actions}>
              <Button
                label={t.common.cancel}
                accessibilityLabel={s.picker.cancelLabel}
                variant="secondary"
                onPress={onClose}
                testID="role-picker-cancel"
              />
            </View>
          </View>
        )}
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
  hint: { ...typography.caption, color: colors.textMuted },
  options: { gap: spacing.sm },
  option: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  optionText: { ...typography.label, color: colors.text },
  checkedText: { color: colors.onPrimary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
