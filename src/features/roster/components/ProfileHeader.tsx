import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { ManagerProfile } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, spacing, typography } from '@/theme';

import { Avatar } from './Avatar';

/** "<Name>'s teams" heading with the avatar and a "Switch profile" button. */
export function ProfileHeader({
  profile,
  onSwitch,
}: {
  profile: ManagerProfile;
  onSwitch: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.who}>
        <Avatar name={profile.name} color={profile.color} />
        <Text style={styles.heading} accessibilityRole="header" numberOfLines={2}>
          {t.roster.teams.heading(profile.name)}
        </Text>
      </View>
      <Button label={t.roster.teams.switchProfile} variant="secondary" compact onPress={onSwitch} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  heading: { ...typography.heading, color: colors.text, flexShrink: 1 },
});
