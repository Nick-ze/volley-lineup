import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { suggestLiberoReplaces } from '@/domain/liberoSwap';
import { setLiberoReplaces, toggleLiberoReplace } from '@/domain/lineupEditing';
import { COURT_POSITIONS } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import type { LineupEditor } from './useLineupEditor';

/** "Libero replaces": pick which starters the libero comes in for in the back row. */
export function LiberoReplaces({ editor }: { editor: LineupEditor }) {
  const t = useT();
  const { set, players, playerById, update } = editor;
  if (set.liberoId === null) return null;
  const starters = COURT_POSITIONS.map((p) => playerById(set.slots[p])).filter(
    (p) => p !== undefined,
  );
  const s = t.lineup.liberoReplaces;

  return (
    <View style={styles.box} testID="libero-replaces">
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.hint}>{s.hint}</Text>
        </View>
        <Button
          label={s.suggest}
          accessibilityLabel={s.suggestLabel}
          variant="ghost"
          compact
          disabled={starters.length === 0}
          onPress={() => update(setLiberoReplaces(set, suggestLiberoReplaces(set, players)))}
          testID="libero-replaces-suggest"
        />
      </View>
      {starters.length === 0 ? (
        <Text style={styles.hint}>{s.noStarters}</Text>
      ) : (
        <View style={styles.options} accessibilityLabel={s.groupLabel}>
          {starters.map((p) => {
            const checked = set.liberoReplaces.includes(p.id);
            const name = p.lastName || p.firstName;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="checkbox"
                accessibilityLabel={s.optionLabel(p.number, `${p.firstName} ${p.lastName}`)}
                accessibilityState={{ checked }}
                aria-checked={checked}
                onPress={() => update(toggleLiberoReplace(set, p.id))}
                style={({ pressed }) => [
                  styles.option,
                  checked && styles.checked,
                  pressed && styles.pressed,
                ]}
                testID={`libero-replaces-${p.number}`}
              >
                <Text style={[styles.optionText, checked && styles.checkedText]}>
                  {s.optionText(p.number, name)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titles: { flex: 1, gap: spacing.xxs },
  title: { ...typography.label, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
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
  pressed: { opacity: 0.8 },
  optionText: { ...typography.label, color: colors.text },
  checkedText: { color: colors.onPrimary },
});
