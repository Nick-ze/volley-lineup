import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

import { Section } from './Section';

/** Shows the current profile and goes back to the profile picker. */
export function ProfileSection() {
  const t = useT();
  const router = useRouter();
  const profile = useAppStore(selectCurrentProfile);
  const selectProfile = useAppStore((s) => s.selectProfile);

  const switchProfile = () => {
    // Clear the selection so the picker never auto-forwards to the old profile's teams.
    selectProfile(null);
    router.dismissTo('/');
  };

  return (
    <Section title={t.transfer.profile.title}>
      <View style={styles.row}>
        {profile ? <View style={[styles.dot, { backgroundColor: profile.color }]} /> : null}
        <Text style={styles.name}>
          {profile ? t.transfer.profile.current(profile.name) : t.transfer.profile.none}
        </Text>
      </View>
      <Button label={t.transfer.profile.switch} variant="secondary" onPress={switchProfile} />
    </Section>
  );
}

const DOT = spacing.lg;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: DOT, height: DOT, borderRadius: radius.round },
  name: { ...typography.body, color: colors.text, flexShrink: 1 },
});
