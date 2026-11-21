import { StyleSheet, Text, View } from 'react-native';

import type { ManagerProfile } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { Avatar } from './Avatar';

/** "<Name>'s teams" heading with the avatar. Switching profile lives in the Profile tab. */
export function ProfileHeader({ profile }: { profile: ManagerProfile }) {
  const t = useT();
  return (
    <View style={styles.who}>
      <Avatar name={profile.name} color={profile.color} />
      <Text style={styles.heading} accessibilityRole="header" numberOfLines={2}>
        {t.roster.teams.heading(profile.name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  heading: { ...typography.heading, color: colors.text, flexShrink: 1 },
});
