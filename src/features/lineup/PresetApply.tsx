import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { applyPresetToSet, filledCount } from '@/domain/presets';
import type { LineupPreset } from '@/domain/types';
import { useT } from '@/i18n';
import { usePresetsForTeam, useStarters } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

export interface PresetApplyProps {
  editor: LineupDraft;
  teamId: string;
}

/** What was applied, kept as data so the message follows a language switch. */
type Outcome = { name: string | null; skipped: string[] } | null;

/**
 * "Use team starters" and "Apply preset…" for a match set. Disabled for played (locked) sets and
 * when there is nothing to apply (no presets; no or empty starters, which would only wipe the
 * set) — the reason is the disabled button's accessibility hint. Afterwards it says who was left
 * out (injured / not in the team).
 * Remount (key by set number) to reset the message.
 */
export function PresetApply({ editor, teamId }: PresetApplyProps) {
  const t = useT();
  const s = t.presets.apply;
  const { set, players, replace, locked, playerById } = editor;
  const saved = useStarters(teamId);
  // Empty starters (0/6, no libero) would only clear the set: treat them as "no starters".
  const starters = saved && (filledCount(saved) > 0 || saved.liberoId !== null) ? saved : undefined;
  const presets = usePresetsForTeam(teamId);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const apply = (preset: LineupPreset) => {
    const result = applyPresetToSet(set, preset, players);
    replace(result.set);
    setOpen(false);
    setOutcome({ name: preset.kind === 'starters' ? null : preset.name, skipped: result.skipped });
  };

  const message = (() => {
    if (!outcome) return null;
    const name = outcome.name ?? s.startersName;
    if (outcome.skipped.length === 0) return s.applied(name);
    const who = outcome.skipped.map((id) => {
      const p = playerById(id);
      return p ? `#${p.number} ${p.firstName} ${p.lastName}`.trim() : s.unknownPlayer;
    });
    return s.skipped(name, who.join(', '));
  })();

  const startersHint = locked ? s.locked : starters ? s.useStartersLabel : s.noStarters;
  const presetHint = locked ? s.locked : presets.length > 0 ? s.applyPresetLabel : s.noPresets;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button
          label={s.useStarters}
          accessibilityHint={startersHint}
          variant="secondary"
          compact
          disabled={locked || !starters}
          onPress={() => starters && apply(starters)}
          testID="use-starters"
          style={styles.grow}
        />
        <Button
          label={s.applyPreset}
          accessibilityHint={presetHint}
          variant="secondary"
          compact
          disabled={locked || presets.length === 0}
          onPress={() => {
            setOutcome(null);
            setOpen((v) => !v);
          }}
          testID="apply-preset"
          style={styles.grow}
        />
      </View>
      {open && !locked ? (
        <View style={styles.box} testID="preset-picker">
          <Text style={styles.hint}>{s.choose}</Text>
          {presets.map((p) => (
            <Button
              key={p.id}
              label={p.name}
              accessibilityLabel={s.presetLabel(p.name)}
              compact
              onPress={() => apply(p)}
              testID={`apply-preset-${p.name}`}
            />
          ))}
          <Button
            label={s.cancel}
            accessibilityLabel={s.cancelLabel}
            variant="ghost"
            compact
            onPress={() => setOpen(false)}
          />
        </View>
      ) : null}
      {message ? (
        <Text
          style={[styles.message, outcome && outcome.skipped.length > 0 && styles.warn]}
          accessibilityLiveRegion="polite"
          testID="preset-message"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hint: { ...typography.caption, color: colors.textMuted },
  message: { ...typography.body, color: colors.text },
  warn: { color: colors.highlight },
});
