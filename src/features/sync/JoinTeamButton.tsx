import { useRouter } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from '@/components';
import { useT } from '@/i18n';
import { isSyncConfigured } from '@/lib/sync';

/** v10: "Join a team" on the Teams tab → `/join` (only when the app has a sync backend). */
export function JoinTeamButton({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const router = useRouter();
  if (!isSyncConfigured()) return null;
  return (
    <Button
      label={t.sync.team.join}
      accessibilityLabel={t.sync.team.joinLabel}
      variant="secondary"
      onPress={() => router.push('/join')}
      testID="join-team"
      style={style}
    />
  );
}
