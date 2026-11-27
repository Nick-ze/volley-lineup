import { Pressable, Text, View } from 'react-native';

import { fullName, shortName } from '@/domain/playerNames';
import { Button, ToggleRow } from '@/components';
import { suggestLiberoReplaces } from '@/domain/liberoSwap';
import { setLiberoReplaces, toggleLiberoReplace } from '@/domain/lineupEditing';
import { setLiberoActive } from '@/domain/roles';
import { COURT_POSITIONS } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { LiberoRoleChips } from './LiberoRoleChips';
import type { LineupDraft } from './useLineupDraft';

/**
 * "Libero plays" switch (off = the libero stays out, no swaps) and "Libero replaces": pick by role
 * or by player which starters the libero comes in for in the back row.
 */
export function LiberoReplaces({ editor }: { editor: LineupDraft }) {
  const styles = useStyles();
  const t = useT();
  const { set, players, playerById, update } = editor;
  if (set.liberoId === null) return null;
  const starters = COURT_POSITIONS.map((p) => playerById(set.slots[p])).filter(
    (p) => p !== undefined,
  );
  const s = t.lineup.liberoReplaces;
  const out = !set.liberoActive;

  return (
    <View style={styles.box} testID="libero-replaces">
      <ToggleRow
        label={t.lineup.liberoPlays}
        value={set.liberoActive}
        onChange={(v) => update(setLiberoActive(set, v))}
        testID="libero-plays"
      />
      {out ? (
        <Text style={styles.hint} testID="libero-out">
          {t.lineup.liberoOut}
        </Text>
      ) : null}
      <View style={[styles.section, out && styles.greyed]} testID="libero-replaces-section">
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
            disabled={out || starters.length === 0}
            onPress={() => update(setLiberoReplaces(set, suggestLiberoReplaces(set, players)))}
            testID="libero-replaces-suggest"
          />
        </View>
        {starters.length === 0 ? (
          <Text style={styles.hint}>{s.noStarters}</Text>
        ) : (
          <>
            <LiberoRoleChips editor={editor} disabled={out} />
            <Text style={styles.hint}>{t.lineup.liberoRoles.players}</Text>
            <View style={styles.options} accessibilityLabel={s.groupLabel}>
              {starters.map((p) => {
                const checked = set.liberoReplaces.includes(p.id);
                const shown = s.optionText(p.number, shortName(p, players));
                return (
                  <Pressable
                    key={p.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={s.optionLabel(shown, fullName(p))}
                    accessibilityState={{ checked, disabled: out }}
                    aria-checked={checked}
                    aria-disabled={out}
                    disabled={out}
                    onPress={() => update(toggleLiberoReplace(set, p.id))}
                    style={({ pressed }) => [
                      styles.option,
                      checked && styles.checked,
                      pressed && styles.pressed,
                    ]}
                    testID={`libero-replaces-${p.number}`}
                  >
                    <Text style={[styles.optionText, checked && styles.checkedText]}>{shown}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
  },
  section: { gap: spacing.sm },
  greyed: { opacity: 0.4 },
  // The suggest button moves under the titles when both don't fit (German, dyslexia font).
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  titles: { flexGrow: 1, flexShrink: 1, flexBasis: touchTarget * 4, gap: spacing.xxs },
  title: { ...typography.label, color: theme.colors.text },
  hint: { ...typography.caption, color: theme.colors.textMuted },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: theme.colors.primarySoft },
  pressed: { opacity: 0.8 },
  optionText: { ...typography.label, color: theme.colors.text },
  checkedText: { color: theme.colors.primaryText },
}));
