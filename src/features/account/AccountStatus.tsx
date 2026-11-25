import { Text } from 'react-native';

import { Button } from '@/components';
import { formatSyncTime } from '@/domain/syncSetup';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { syncNow } from '@/lib/sync';
import { useSyncStatus } from '@/store';
import { makeStyles, typography } from '@/theme';

import { ErrorText } from './ErrorText';
import { useStatusLine } from './useStatusLine';

/** v10: Account → the signed-in email, the sync status (phase, pending, last synced), Sync now. */
export function AccountStatus({ email }: { email: string }) {
  const styles = useStyles();
  const t = useT();
  const status = useSyncStatus();
  const line = useStatusLine();
  const last = status.lastSyncedAt
    ? t.account.screen.lastSynced(formatSyncTime(status.lastSyncedAt))
    : t.account.screen.notSynced;
  return (
    <Section title={t.account.title}>
      <Text style={styles.email} testID="account-email">
        {t.account.profileSection.signedIn(email)}
      </Text>
      <Text style={styles.status} accessibilityLiveRegion="polite" testID="account-status">
        {line}
      </Text>
      <Text style={styles.muted}>{last}</Text>
      <ErrorText error={status.phase === 'error' ? status.error : null} />
      <Button
        label={t.sync.status.syncNow}
        onPress={() => void syncNow()}
        disabled={status.phase === 'syncing'}
        testID="sync-now"
      />
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  email: { ...typography.subheading, color: theme.colors.text },
  status: { ...typography.body, color: theme.colors.text },
  muted: { ...typography.caption, color: theme.colors.textMuted },
}));
