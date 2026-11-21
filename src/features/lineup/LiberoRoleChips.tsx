import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LIBERO_ROLE_GROUPS, liberoRoleState, toggleLiberoRole } from '@/domain/liberoRoles';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

/**
 * Role chips for "Libero replaces" (Middles / Outsides / Opposite / Setter / DS): each sets
 * whom the libero replaces to (or removes) the starters playing that role. Several can be on.
 */
export function LiberoRoleChips({ editor, disabled }: { editor: LineupDraft; disabled: boolean }) {
  const t = useT();
  const { set, players, update } = editor;
  const s = t.lineup.liberoRoles;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{s.title}</Text>
      <View style={styles.options} accessibilityLabel={s.groupLabel}>
        {LIBERO_ROLE_GROUPS.map((role) => {
          const state = liberoRoleState(set, players, role);
          const checked = state === 'on';
          const empty = state === 'empty';
          // When the libero is off, the parent section already dims everything.
          const off = disabled || empty;
          return (
            <Pressable
              key={role}
              accessibilityRole="checkbox"
              accessibilityLabel={s.optionLabel(s.groups[role])}
              accessibilityState={{ checked, disabled: off }}
              aria-checked={checked}
              aria-disabled={off}
              disabled={off}
              onPress={() => update(toggleLiberoRole(set, players, role))}
              style={({ pressed }) => [
                styles.option,
                checked && styles.checked,
                empty && styles.disabled,
                pressed && styles.pressed,
              ]}
              testID={`libero-role-${role}`}
            >
              <Text style={[styles.optionText, checked && styles.checkedText]}>
                {s.groups[role]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: { ...typography.caption, color: colors.textMuted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  optionText: { ...typography.label, color: colors.text },
  checkedText: { color: colors.onPrimary },
});
