import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, ConfirmDialog, Screen, useConfirm } from '@/components';
import { Section } from '@/features/settings/Section';
import { TourSection, useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import {
  selectCurrentProfile,
  useAppStore,
  useSession,
  useSyncAccount,
  useSyncStatus,
} from '@/store';
import { makeStyles, typography } from '@/theme';

import { AccountSection } from './AccountSection';
import { AppearanceSection } from './AppearanceSection';
import { deleteProfileSignedOut } from './deleteProfileSignedOut';
import { ProfileCard } from './ProfileCard';
import { useLeaveProfile } from './useLeaveProfile';

/** `/profile` tab: the current profile, edit it, log out (back to the picker), delete it. */
export function ProfileScreen() {
  const styles = useStyles();
  const t = useT();
  const profile = useAppStore(selectCurrentProfile);
  useTourPage(profile ? 'profile' : null);
  const leaveProfile = useLeaveProfile();
  const { ask, dialogProps } = useConfirm();
  // v10: logging out of the signed-in profile with unsynced changes asks first.
  const logoutConfirm = useConfirm();
  const signedIn = useSession() !== null;
  const { pending } = useSyncStatus();
  const account = useSyncAccount();
  // While leaving, the navigation to the picker is already under way: don't redirect twice.
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    setLeaving(true);
    leaveProfile();
  };

  if (!profile) return leaving ? null : <Redirect href="/" />;

  const linked = account?.profileId === profile.id;
  const logout = () =>
    linked && signedIn && pending > 0
      ? logoutConfirm.ask(t.account.screen.signOutConfirm(pending), leave)
      : leave();
  const deleteMessage = t.roster.confirm.deleteProfile(profile.name);
  const deleteProfile = () =>
    ask(linked && signedIn ? `${deleteMessage} ${t.account.signOutNote}` : deleteMessage, () => {
      deleteProfileSignedOut(profile.id);
      leave();
    });

  return (
    <Screen testID="profile-screen">
      <ProfileCard profile={profile} />
      <AppearanceSection />
      <TourSection />
      <AccountSection />
      <Section title={t.profile.account} hint={t.profile.logoutHint}>
        <Button label={t.profile.logout} onPress={logout} testID="logout" />
        <Text style={styles.note}>{t.profile.logoutNote}</Text>
      </Section>
      <Section title={t.profile.dangerTitle} hint={t.profile.dangerHint} tone="danger">
        <Button
          label={t.profile.delete}
          accessibilityLabel={t.profile.deleteLabel(profile.name)}
          variant="danger"
          onPress={deleteProfile}
        />
      </Section>
      <ConfirmDialog {...dialogProps} />
      <ConfirmDialog {...logoutConfirm.dialogProps} confirmLabel={t.profile.logout} />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  note: { ...typography.caption, color: theme.colors.textMuted },
}));
