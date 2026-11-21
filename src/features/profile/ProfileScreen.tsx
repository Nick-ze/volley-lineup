import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Screen } from '@/components';
import { ConfirmDialog } from '@/features/roster/components/ConfirmDialog';
import { useConfirm } from '@/features/roster/hooks/useConfirm';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore } from '@/store';
import { colors, typography } from '@/theme';

import { ProfileCard } from './ProfileCard';
import { useLeaveProfile } from './useLeaveProfile';

/** `/profile` tab: the current profile, edit it, switch profile, log out, delete it. */
export function ProfileScreen() {
  const t = useT();
  const profile = useAppStore(selectCurrentProfile);
  const leaveProfile = useLeaveProfile();
  const { ask, dialogProps } = useConfirm();
  // While leaving, the navigation to the picker is already under way: don't redirect twice.
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    setLeaving(true);
    leaveProfile();
  };

  if (!profile) return leaving ? null : <Redirect href="/" />;

  const deleteProfile = () =>
    ask(t.roster.confirm.deleteProfile(profile.name), () => {
      useAppStore.getState().deleteProfile(profile.id);
      leave();
    });

  return (
    <Screen testID="profile-screen">
      <ProfileCard profile={profile} />
      <Section title={t.profile.account} hint={t.profile.switchHint}>
        <Button label={t.profile.switch} variant="secondary" onPress={leave} />
        <Button label={t.profile.logout} onPress={leave} testID="logout" />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { ...typography.caption, color: colors.textMuted },
});
