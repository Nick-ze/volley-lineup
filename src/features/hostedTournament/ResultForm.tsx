import { useState } from 'react';
import { Text, View } from 'react-native';

import { Banner, Button, useFormStyles } from '@/components';
import {
  leadingSets,
  matchOutcome,
  readResultForm,
  setInputError,
  visibleSetRows,
  type HostedSettings,
  type ResultError,
  type SetInput,
  type SetInputError,
} from '@/domain/hostedTournament';
import type { HostedSetScore } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { ResultScoreboard } from './ResultScoreboard';
import { ScoreField } from './ScoreField';

export interface ResultFormProps {
  teamA: string;
  teamB: string;
  settings: HostedSettings;
  /** The stored sets as seen from team A (empty: no result yet). */
  initial: readonly HostedSetScore[];
  onSave: (sets: HostedSetScore[]) => void;
  onCancel: () => void;
  /** Only when a result is stored (round robin) — or always, for a match the coach added. */
  onDelete?: () => void;
  /** The delete button's text ("Delete result"; own matches: "Delete match"). */
  deleteLabel?: string;
  /** Own matches (v12.1): saving without a set is fine — the match has no result then. */
  allowEmpty?: boolean;
  /**
   * v12.2: the match was scored live — its sets are shown but can't be changed here (the rallies
   * would no longer add up); there is no Save.
   */
  locked?: boolean;
}

const EMPTY_ROW: SetInput = { a: '', b: '' };

/**
 * A match's result, set by set: one row per set with two number fields. The next set's row
 * appears when the one before is valid and the match isn't decided. Errors stand under their
 * row. Clearing both fields of the last set removes that set.
 */
export function ResultForm({
  teamA,
  teamB,
  settings,
  initial,
  onSave,
  onCancel,
  onDelete,
  deleteLabel,
  allowEmpty = false,
  locked = false,
}: ResultFormProps) {
  const formStyles = useFormStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.result;
  const [rows, setRows] = useState<SetInput[]>(() =>
    initial.map((set) => ({ a: `${set.a}`, b: `${set.b}` })),
  );
  // What "Save" found: incomplete rows, and a result the settings don't allow.
  const [missing, setMissing] = useState<Partial<Record<number, SetInputError>>>({});
  const [resultError, setResultError] = useState<ResultError | undefined>();

  // Locked: the stored sets, no empty row for a next one.
  const count = locked ? rows.length : visibleSetRows(rows, settings);
  const shown = Array.from({ length: count }, (_, i) => rows[i] ?? EMPTY_ROW);
  const outcome = matchOutcome(leadingSets(shown), settings);

  const change = (index: number, side: keyof SetInput, text: string) => {
    setRows((old) => {
      const next = Array.from(
        { length: Math.max(old.length, index + 1) },
        (_, i) => old[i] ?? EMPTY_ROW,
      );
      next[index] = { ...next[index], [side]: text };
      return next;
    });
    setMissing({});
    setResultError(undefined);
  };

  const save = () => {
    const result = readResultForm(shown, settings);
    if (!result.ok) {
      setMissing(result.errors);
      return setResultError(result.resultError);
    }
    if (result.sets.length === 0 && !allowEmpty) return setResultError('EMPTY');
    onSave(result.sets);
  };

  return (
    <View style={styles.wrap}>
      <ResultScoreboard teamA={teamA} teamB={teamB} setsA={outcome.setsA} setsB={outcome.setsB} />
      {shown.map((row, index) => {
        const error = setInputError(row) ?? missing[index];
        const set = index + 1;
        return (
          <View key={index} style={styles.set} testID={`result-set-${set}`}>
            <View style={styles.row}>
              <Text style={[formStyles.eyebrow, styles.label]}>{s.set(set)}</Text>
              <ScoreField
                value={row.a}
                onChangeText={(text) => change(index, 'a', text)}
                accessibilityLabel={s.scoreLabel(set, teamA)}
                error={error !== undefined}
                autoFocus={index === 0 && initial.length === 0 && !locked}
                editable={!locked}
                testID={`result-set-${set}-a`}
              />
              <Text style={styles.colon} accessibilityElementsHidden importantForAccessibility="no">
                {s.colon}
              </Text>
              <ScoreField
                value={row.b}
                onChangeText={(text) => change(index, 'b', text)}
                accessibilityLabel={s.scoreLabel(set, teamB)}
                error={error !== undefined}
                editable={!locked}
                testID={`result-set-${set}-b`}
              />
            </View>
            {error ? (
              <Text
                style={styles.error}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                testID={`result-set-${set}-error`}
              >
                {s.errors[error]}
              </Text>
            ) : null}
          </View>
        );
      })}
      {locked ? null : <Text style={formStyles.hint}>{s.hint}</Text>}
      {resultError ? (
        <Banner alert testID="result-error">
          {s.errors[resultError]}
        </Banner>
      ) : null}
      <View style={styles.actions}>
        {onDelete ? (
          <Button
            label={deleteLabel ?? s.delete}
            variant="dangerQuiet"
            style={styles.delete}
            compact
            onPress={onDelete}
            testID="result-delete"
          />
        ) : null}
        <Button label={t.common.cancel} variant="secondary" compact onPress={onCancel} />
        {locked ? null : (
          <Button label={t.common.save} compact onPress={save} testID="result-save" />
        )}
      </View>
    </View>
  );
}

/** Width of the "Set 1" label before the fields (wider with the dyslexia font). */
const LABEL_WIDTH = 48;
const LABEL_WIDTH_WIDE_FONT = 64;

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.md },
  set: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: theme.dyslexiaFont ? LABEL_WIDTH_WIDE_FONT : LABEL_WIDTH },
  colon: { ...typography.heading, color: theme.colors.textMuted },
  error: { ...typography.label, color: theme.colors.error },
  // Delete at the left, Cancel and Save at the right; when they wrap, each line ends at the right.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  delete: { marginRight: 'auto' },
}));
