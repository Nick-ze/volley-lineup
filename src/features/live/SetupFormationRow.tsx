import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FORMATION_ORDERS, FORMATION_SYSTEMS } from '@/domain/roles';
import type { Formation, FormationOrder } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface SetupFormationRowProps {
  formation: Formation;
  onChange: (change: Partial<Pick<Formation, 'system' | 'order'>>) => void;
}

interface Option {
  key: string;
  label: string;
  accessibilityLabel: string;
  active: boolean;
  onPress: () => void;
}

/** One radio group of the formation (system or order), as a two-part switch. */
function Choice({ label, options }: { label: string; options: Option[] }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel}
            accessibilityState={{ checked: o.active }}
            // react-native-web ignores accessibilityState: expose the state with aria-* too.
            aria-checked={o.active}
            onPress={o.onPress}
            style={[styles.option, o.active && styles.active]}
            testID={`setup-formation-${o.key}`}
          >
            <Text style={[styles.text, o.active && styles.activeText]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * The formation of the set being set up in live mode (v5): system 5-1 / 6-2 and the order after
 * the setter (outside / middle). The setter spot is kept; the rotate buttons move it.
 */
export function SetupFormationRow({ formation, onChange }: SetupFormationRowProps) {
  const t = useT();
  const s = t.live.setup;
  const systems: Option[] = FORMATION_SYSTEMS.map((system) => ({
    key: system,
    label: system,
    accessibilityLabel: s.systemOption(system),
    active: formation.system === system,
    onPress: () => onChange({ system }),
  }));
  const orderText: Record<FormationOrder, readonly [string, string]> = {
    outside: [s.orderOutside, s.orderOutsideLabel],
    middle: [s.orderMiddle, s.orderMiddleLabel],
  };
  const orders: Option[] = FORMATION_ORDERS.map((order) => ({
    key: order,
    label: orderText[order][0],
    accessibilityLabel: orderText[order][1],
    active: formation.order === order,
    onPress: () => onChange({ order }),
  }));
  return (
    <View style={styles.wrap} testID="setup-formation">
      <Choice label={s.systemLabel} options={systems} />
      <Choice label={s.orderLabel} options={orders} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  group: { gap: spacing.xxs },
  label: { ...typography.label, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.primary },
  text: { ...typography.label, color: colors.text, textAlign: 'center' },
  activeText: { color: colors.onPrimary },
});
