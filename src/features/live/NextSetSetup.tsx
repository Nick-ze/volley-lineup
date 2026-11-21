import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { presetFromSet, filledCount } from '@/domain/presets';
import { COURT_POSITIONS, type Match, type SetLineup, type SetNumber } from '@/domain/types';
import { ServeToggle } from '@/features/lineup/ServeToggle';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

import { playerRef } from './format';
import { useSetupDraft } from './useSetupDraft';

export interface NextSetSetupProps {
  match: Match;
  setNumber: SetNumber;
  /** Stores the set (Start, or before opening the lineup builder). */
  onSave: (set: SetLineup) => void;
  /** Opens the lineup builder for this set. */
  onEdit: () => void;
  /** The previous won set whose last point Undo removes, or null. */
  undoSet: SetNumber | null;
  onUndo: () => void;
}

/**
 * Setting up a set inside live mode: fill it from the team starters, a preset or the previous
 * set, choose who serves first, then Start (enabled once six players are on court).
 */
export function NextSetSetup({
  match,
  setNumber,
  onSave,
  onEdit,
  undoSet,
  onUndo,
}: NextSetSetupProps) {
  const t = useT();
  const s = t.live.setup;
  const players = usePlayersForTeam(match.teamId);
  const playersById = new Map(players.map((p) => [p.id, p]));
  const { draft, sources, skipped, complete, fill, setServe, clear } = useSetupDraft(
    match,
    setNumber,
    players,
  );
  const ref = (id: string) => playerRef(t, playersById, id);
  const onCourt = COURT_POSITIONS.flatMap((p) => {
    const id = draft.slots[p];
    return id ? [ref(id)] : [];
  });
  const { starters, presets, previous } = sources;
  const hasSources = !!starters || !!previous || presets.length > 0;

  return (
    <View style={styles.box} testID="set-setup">
      <Text style={styles.title} accessibilityRole="header">
        {s.title(setNumber)}
      </Text>
      <Text style={styles.text} testID="setup-filled">
        {s.filled(filledCount(draft))}
        {onCourt.length > 0 ? ` · ${s.onCourt(onCourt.join(', '))}` : ''}
        {draft.liberoId ? ` · ${s.libero(ref(draft.liberoId))}` : ''}
      </Text>
      {hasSources ? <Text style={styles.label}>{s.fillFrom}</Text> : null}
      <View style={styles.row}>
        {starters ? (
          <Button
            label={s.starters}
            accessibilityLabel={s.startersLabel}
            variant="secondary"
            compact
            onPress={() => fill(starters)}
            testID="setup-starters"
          />
        ) : null}
        {previous ? (
          <Button
            label={s.copy(previous.setNumber)}
            accessibilityLabel={s.copyLabel(previous.setNumber)}
            variant="secondary"
            compact
            onPress={() => fill(presetFromSet(previous))}
            testID="setup-copy"
          />
        ) : null}
        {presets.map((p) => (
          <Button
            key={p.id}
            label={p.name}
            accessibilityLabel={s.presetLabel(p.name)}
            variant="secondary"
            compact
            onPress={() => fill(p)}
            testID={`setup-preset-${p.name}`}
          />
        ))}
      </View>
      {hasSources ? null : <Text style={styles.text}>{s.nothing}</Text>}
      {skipped.length > 0 ? (
        <Text style={styles.warn} accessibilityLiveRegion="polite" testID="setup-skipped">
          {s.skipped(skipped.map(ref).join(', '))}
        </Text>
      ) : null}
      <Text style={styles.label}>{t.live.serveChoice}</Text>
      <ServeToggle weServeFirst={draft.weServeFirst} onChange={setServe} />
      <Button
        label={t.live.startSet(setNumber)}
        accessibilityHint={complete ? undefined : s.startHint}
        disabled={!complete}
        onPress={() => {
          onSave(draft);
          clear();
        }}
        testID="setup-start"
      />
      <View style={styles.row}>
        <Button
          label={s.edit}
          accessibilityLabel={s.editLabel}
          variant="secondary"
          compact
          style={styles.grow}
          onPress={() => {
            onSave(draft);
            clear();
            onEdit();
          }}
          testID="setup-edit"
        />
        {undoSet !== null ? (
          <Button
            label={t.live.undoLastPoint}
            accessibilityLabel={t.live.undoAcross(undoSet)}
            variant="secondary"
            compact
            style={styles.grow}
            onPress={onUndo}
            testID="undo"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.subheading, color: colors.text },
  label: { ...typography.label, color: colors.textMuted },
  text: { ...typography.body, color: colors.text },
  warn: { ...typography.body, color: colors.highlight },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
});
