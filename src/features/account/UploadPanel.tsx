import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components';
import type { SyncErrorCode, Team } from '@/domain/types';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { uploadTeams, type UploadResult } from '@/lib/sync';
import { useAppStore } from '@/store';
import { makeStyles, typography } from '@/theme';

import { CheckRow } from './CheckRow';
import { ErrorText } from './ErrorText';

interface Outcome {
  name: string;
  result: UploadResult;
}

/**
 * v10: Cloud teams → Upload: this profile's unshared teams, all **unchecked** (nothing is uploaded
 * unless the user ticks it and taps "Upload selected"), then one result line per team.
 */
export function UploadPanel({ teams }: { teams: Team[] }) {
  const styles = useStyles();
  const t = useT();
  const s = t.account.cloudTeams.upload;
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const ids = teams.filter((team) => selected.has(team.id)).map((team) => team.id);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const upload = async () => {
    const names = new Map(teams.map((team) => [team.id, team.name]));
    setBusy(true);
    const result = await uploadTeams(ids);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSelected(new Set());
    // A re-keyed team comes back under its new id: find its name in the store then.
    const stored = useAppStore.getState().teams;
    const nameOf = (id: string, i: number) =>
      names.get(id) ?? stored.find((team) => team.id === id)?.name ?? names.get(ids[i] ?? '');
    setOutcomes(
      result.value.map((r, i) => ({ name: nameOf(r.teamId, i) ?? '', result: r.result })),
    );
  };

  return (
    <Section title={s.title} hint={s.hint}>
      {teams.length === 0 ? <Text style={styles.muted}>{s.empty}</Text> : null}
      {teams.map((team) => (
        <CheckRow
          key={team.id}
          label={team.name}
          checked={selected.has(team.id)}
          onToggle={() => toggle(team.id)}
          disabled={busy}
          testID={`upload-${team.id}`}
        />
      ))}
      {teams.length > 0 ? (
        <Button
          label={s.button}
          onPress={() => void upload()}
          disabled={busy || ids.length === 0}
          testID="upload-selected"
        />
      ) : null}
      <ErrorText error={error} testID="upload-error" />
      {outcomes.map((o, i) => (
        <Text key={i} style={styles.result} accessibilityLiveRegion="polite">
          {s.result(o.name, s.results[o.result])}
        </Text>
      ))}
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  muted: { ...typography.body, color: theme.colors.textMuted },
  result: { ...typography.body, color: theme.colors.text },
}));
