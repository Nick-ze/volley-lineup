import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { ManagerProfile } from '@/domain/types';
import { applyPhotoDraft } from '@/features/photos/photoDraft';
import { Avatar } from '@/features/roster/components/Avatar';
import { ProfileForm } from '@/features/roster/components/ProfileForm';
import { useT } from '@/i18n';
import { useAppStore, useTeamsForProfile } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

const AVATAR_SIZE = 64;

/** The current profile (avatar, name, team/player counts) with inline name / colour / photo editing. */
export function ProfileCard({ profile }: { profile: ManagerProfile }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const teams = useTeamsForProfile(profile.id);
  const playerCount = useAppStore((s) => {
    const ids = new Set(s.teams.filter((tm) => tm.profileId === profile.id).map((tm) => tm.id));
    return s.players.filter((p) => ids.has(p.teamId)).length;
  });

  if (editing) {
    return (
      <ProfileForm
        initial={{ name: profile.name, color: profile.color }}
        photoId={profile.photoId}
        submitLabel={t.common.save}
        onCancel={() => setEditing(false)}
        onSubmit={(value, photo) => {
          const { updateProfile } = useAppStore.getState();
          updateProfile(profile.id, value);
          void applyPhotoDraft(photo, (photoId) => updateProfile(profile.id, { photoId }));
          setEditing(false);
        }}
      />
    );
  }

  return (
    <View style={styles.card} testID="profile-card">
      <View style={styles.who}>
        <Avatar
          name={profile.name}
          color={profile.color}
          photoId={profile.photoId}
          size={AVATAR_SIZE}
        />
        <View style={styles.text}>
          <Text style={styles.caption}>{t.profile.current}</Text>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={2}>
            {profile.name}
          </Text>
          <Text style={styles.caption}>{t.profile.counts(teams.length, playerCount)}</Text>
        </View>
      </View>
      <Button
        label={t.profile.edit}
        accessibilityLabel={t.profile.editLabel(profile.name)}
        variant="secondary"
        onPress={() => setEditing(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  text: { flexShrink: 1, gap: spacing.xs },
  name: { ...typography.heading, color: colors.text },
  caption: { ...typography.body, color: colors.textMuted },
});
