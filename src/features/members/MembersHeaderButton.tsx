import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { useT } from '@/i18n';
import { isSyncConfigured } from '@/lib/sync';
import { useTeamAccess } from '@/store';
import { fontSize, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/**
 * v10: the team header's button (top right) to the members screen: "Members" for a shared team,
 * "Share" for a local one. Hidden when the app has no backend configured.
 */
export function MembersHeaderButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const t = useT();
  const styles = useStyles();
  const router = useRouter();
  const { shared } = useTeamAccess(teamId);
  if (!isSyncConfigured()) return null;
  const s = t.members.header;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shared ? s.membersLabel(teamName) : s.shareLabel(teamName)}
      onPress={() => router.push({ pathname: '/team/[teamId]/members', params: { teamId } })}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="team-members-button"
    >
      <Text style={styles.label} numberOfLines={1}>
        {shared ? s.members : s.share}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  button: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  pressed: { opacity: 0.7 },
  // Like the live screen's header button: the wide dyslexia font gets a smaller label at 375 px.
  label: {
    ...typography.body,
    ...(theme.dyslexiaFont ? { fontSize: fontSize.sm } : null),
    color: theme.colors.text,
  },
}));
