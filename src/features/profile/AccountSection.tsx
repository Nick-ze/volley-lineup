import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { Button } from '@/components';
import { SignedOutPanel, useAccountLink, useStatusLine } from '@/features/account';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { isSyncConfigured } from '@/lib/sync';
import { makeStyles, typography } from '@/theme';

/**
 * v10: Profile tab → Cloud sync (only when the backend is configured): Sign in, or the signed-in
 * email with the sync status and a link to Account. Sign-in happens from the profile the account
 * belongs to (docs/V10_SYNC_DESIGN.md §6).
 */
export function AccountSection() {
  if (!isSyncConfigured()) return null;
  return <AccountSectionBody />;
}

function AccountSectionBody() {
  const styles = useStyles();
  const t = useT();
  const s = t.account.profileSection;
  const router = useRouter();
  const link = useAccountLink();
  const status = useStatusLine();
  return (
    <Section title={s.title}>
      {link.kind === 'signedIn' ? (
        <>
          <Text style={styles.email} testID="profile-account-email">
            {s.signedIn(link.email)}
          </Text>
          <Text style={styles.status}>{status}</Text>
          <Button
            label={s.open}
            accessibilityLabel={s.openLabel}
            variant="secondary"
            onPress={() => router.push('/account')}
            testID="profile-account-open"
          />
        </>
      ) : (
        <SignedOutPanel link={link} testID="profile-sign-in" />
      )}
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  email: { ...typography.body, color: theme.colors.text },
  status: { ...typography.caption, color: theme.colors.textMuted },
}));
