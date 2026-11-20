import { StyleSheet, Text, View } from 'react-native';

import { makePrimaryPosition, togglePosition } from '@/domain/roster';
import { ALL_POSITIONS, type Position } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, spacing, typography } from '@/theme';

import { ChoiceChip } from './ChoiceChip';
import { formStyles } from './styles';

export interface PositionPickerProps {
  value: Position[];
  onChange: (positions: Position[]) => void;
  error?: string;
}

/** Multi-select of positions; the first selected is primary and can be changed. */
export function PositionPicker({ value, onChange, error }: PositionPickerProps) {
  const s = t.roster.player;
  return (
    <View style={styles.wrap}>
      <Text style={formStyles.sectionLabel}>{s.positions}</Text>
      <View style={styles.row}>
        {ALL_POSITIONS.map((p) => (
          <ChoiceChip
            key={p}
            label={p}
            accessibilityLabel={t.positions[p]}
            selected={value.includes(p)}
            onPress={() => onChange(togglePosition(value, p))}
            testID={`position-${p}`}
          />
        ))}
      </View>
      <Text style={formStyles.hint}>{s.positionsHint}</Text>
      {value.length > 1 && (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={s.primary}>
          <Text style={formStyles.sectionLabel}>{s.primary}</Text>
          {value.map((p, i) => (
            <ChoiceChip
              key={p}
              role="radio"
              label={p}
              accessibilityLabel={s.makePrimary(t.positions[p])}
              selected={i === 0}
              onPress={() => onChange(makePrimaryPosition(value, p))}
            />
          ))}
        </View>
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  error: { ...typography.label, color: colors.error },
});
