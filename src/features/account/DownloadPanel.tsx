import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components';
import type { SyncErrorCode } from '@/domain/types';
import { Section } from '@/features/settings/Section';
import { StatusMessage } from '@/features/settings/StatusMessage';
import { useT } from '@/i18n';
import { downloadTeams, type CloudTeam } from '@/lib/sync';
import { makeStyles, typography, useTheme } from '@/theme';

import { CheckRow } from './CheckRow';
import { ErrorText } from './ErrorText';

export interface DownloadPanelProps {
  teams: CloudTeam[];
  loading: boolean;
  /** Loading the cloud list failed (e.g. offline). */
  loadError: SyncErrorCode | null;
  reload: () => Promise<void>;
}

/** v10: Cloud teams → Download: the account's cloud teams not on this device, all **checked**. */
export function DownloadPanel({ teams, loading, loadError, reload }: DownloadPanelProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = useT();
  const s = t.account.cloudTeams;
  // Unticked ones are remembered (not the ticked ones), so teams are checked as soon as they load.
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SyncErrorCode | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const ids = teams.filter((c) => !unchecked.has(c.teamId)).map((c) => c.teamId);

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const download = async () => {
    setBusy(true);
    const result = await downloadTeams(ids);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setDone(ids.length);
    await reload();
  };

  const body = () => {
    if (loading && teams.length === 0) {
      return (
        <>
          <ActivityIndicator color={colors.primaryText} accessibilityLabel={s.loading} />
          <Text style={styles.muted}>{s.loading}</Text>
        </>
      );
    }
    if (loadError) {
      return (
        <>
          <ErrorText error={loadError} testID="cloud-load-error" />
          <Button label={s.retry} variant="secondary" onPress={() => void reload()} />
        </>
      );
    }
    if (teams.length === 0) return <Text style={styles.muted}>{s.download.empty}</Text>;
    return (
      <>
        {teams.map((c) => (
          <CheckRow
            key={c.teamId}
            // v10 audit L22: the team record hasn't arrived in the cloud yet.
            label={c.name || s.download.unnamed}
            detail={t.account.screen.roles[c.role]}
            checked={!unchecked.has(c.teamId)}
            onToggle={() => toggle(c.teamId)}
            disabled={busy}
            testID={`download-${c.teamId}`}
          />
        ))}
        <Button
          label={s.download.button}
          onPress={() => void download()}
          disabled={busy || ids.length === 0}
          testID="download-selected"
        />
      </>
    );
  };

  return (
    <Section title={s.download.title} hint={s.download.hint}>
      {body()}
      <ErrorText error={error} testID="download-error" />
      <StatusMessage status={done ? { tone: 'success', text: s.download.done(done) } : null} />
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  muted: { ...typography.body, color: theme.colors.textMuted },
}));
