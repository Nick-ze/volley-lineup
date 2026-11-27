import { Text, View } from 'react-native';

import { Button } from '@/components';
import { filledCount } from '@/domain/presets';
import { formationRotation } from '@/domain/roles';
import { COURT_POSITIONS, type Match, type SetLineup, type SetNumber } from '@/domain/types';
import { ServeToggle } from '@/features/lineup/ServeToggle';
import { useT } from '@/i18n';
import { usePlayersForTeam } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { playerRef } from './format';
import { FormationConfirm } from './FormationConfirm';
import { SetupFormationRow } from './SetupFormationRow';
import { SetupRotateRow } from './SetupRotateRow';
import { SetupSourceButtons } from './SetupSourceButtons';
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
 * set, choose the formation (v5) and rotate it so the setter starts where you want, choose who
 * serves first, then Start (enabled once six players are on court).
 */
export function NextSetSetup({
  match,
  setNumber,
  onSave,
  onEdit,
  undoSet,
  onUndo,
}: NextSetSetupProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.live.setup;
  const players = usePlayersForTeam(match.teamId);
  const playersById = new Map(players.map((p) => [p.id, p]));
  const setup = useSetupDraft(match, setNumber, players);
  const { draft } = setup;
  const ref = (id: string) => playerRef(t, playersById, id);
  const onCourt = COURT_POSITIONS.flatMap((p) => {
    const id = draft.slots[p];
    return id ? [ref(id)] : [];
  });
  const save = () => {
    onSave(draft);
    setup.clear();
  };

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
      <SetupSourceButtons sources={setup.sources} onFill={setup.fill} />
      {setup.skipped.length > 0 ? (
        <Text style={styles.warn} accessibilityLiveRegion="polite" testID="setup-skipped">
          {s.skipped(setup.skipped.map(ref).join(', '))}
        </Text>
      ) : null}
      <SetupFormationRow formation={draft.formation} onChange={setup.changeFormation} />
      <FormationConfirm
        change={setup.pendingFormation}
        playersById={playersById}
        onConfirm={setup.confirmFormation}
        onCancel={setup.cancelFormation}
      />
      <SetupRotateRow setterAt={formationRotation(draft.formation)} onRotate={setup.rotate} />
      <Text style={styles.label}>{t.live.serveChoice}</Text>
      <ServeToggle weServeFirst={draft.weServeFirst} onChange={setup.setServe} onPanel />
      <Button
        label={t.live.startSet(setNumber)}
        accessibilityHint={setup.complete ? undefined : s.startHint}
        disabled={!setup.complete}
        onPress={save}
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
            // An empty draft isn't stored: the builder creates the set on its first edit.
            if (setup.hasPlayers) save();
            onEdit();
          }}
          testID="setup-edit"
        />
        {undoSet !== null ? (
          <Button
            label={t.live.undoLastPoint}
            accessibilityLabel={t.live.undoLastPointAcross(undoSet)}
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

const useStyles = makeStyles((theme) => ({
  box: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { ...typography.subheading, color: theme.colors.text },
  label: { ...typography.label, color: theme.colors.textMuted },
  text: { ...typography.body, color: theme.colors.text },
  warn: { ...typography.body, color: theme.colors.highlightText },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grow: { flexGrow: 1 },
}));
