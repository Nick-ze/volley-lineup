import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, ConfirmDialog, Screen, useConfirm } from '@/components';
import { Section } from '@/features/settings/Section';
import { StatusMessage } from '@/features/settings/StatusMessage';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { signOut } from '@/lib/sync';
import { useSyncStatus } from '@/store';

import { AccountStatus } from './AccountStatus';
import { DeleteAccountSection } from './DeleteAccountSection';
import { SharedTeams } from './SharedTeams';
import { SignedOutPanel } from './SignedOutPanel';
import { useAccountLink } from './useAccountLink';

/**
 * v10: `/account`: the signed-in email and sync status with Sync now, the shared teams with
 * roles, Cloud teams, Join a team, Sign out (asks only with unsynced changes) and Delete account.
 * Not signed in: a short note and Sign in.
 */
export function AccountScreen() {
  const t = useT();
  const s = t.account.screen;
  const router = useRouter();
  useTourPage('account');
  const link = useAccountLink();
  const { pending, error } = useSyncStatus();
  const { ask, dialogProps } = useConfirm();
  const [deleted, setDeleted] = useState(false);
  const notice = (
    <StatusMessage
      status={deleted ? { tone: 'success', text: t.account.deleteAccount.done } : null}
    />
  );

  if (link.kind !== 'signedIn') {
    return (
      <Screen testID="account-screen">
        {notice}
        <Section
          title={t.account.signIn.title}
          hint={
            link.kind !== 'signedOut'
              ? undefined
              : // v10 audit L23: a session the server ended says so here too.
                error === 'signedOut'
                ? t.sync.errors.signedOut
                : s.signedOut
          }
        >
          <SignedOutPanel link={link} testID="account-sign-in" />
        </Section>
      </Screen>
    );
  }

  const doSignOut = () => void signOut();
  const pressSignOut = () =>
    pending > 0 ? ask(s.signOutConfirm(pending), doSignOut) : doSignOut();

  return (
    <Screen testID="account-screen">
      {notice}
      <AccountStatus email={link.email} />
      <SharedTeams />
      <Section title={s.cloudTeams} hint={s.cloudTeamsHint}>
        <Button
          label={s.cloudTeams}
          variant="secondary"
          onPress={() => router.push('/account/teams')}
          testID="account-cloud-teams"
        />
        <Button
          label={s.join}
          variant="secondary"
          onPress={() => router.push('/join')}
          testID="account-join"
        />
      </Section>
      <Section title={s.signOut} hint={s.signOutHint}>
        <Button label={s.signOut} variant="secondary" onPress={pressSignOut} testID="sign-out" />
      </Section>
      <DeleteAccountSection onDeleted={() => setDeleted(true)} />
      <ConfirmDialog {...dialogProps} confirmLabel={s.signOut} />
    </Screen>
  );
}
