import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import type { SyncStatusKey } from '@/domain/syncStatusKey';
import type { SyncStatus } from '@/domain/types';
import { useSyncStatusKey } from '@/features/account';
import { useT, type Strings } from '@/i18n';
import { useSyncAccount, useSyncStatus } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<SyncStatusKey, IconName> = {
  off: 'cloud-outline',
  noTeams: 'cloud-outline',
  synced: 'cloud-done-outline',
  syncing: 'cloud-upload-outline',
  offline: 'cloud-offline-outline',
  error: 'alert-circle-outline',
};

/** Size of the cloud mark (px). */
const ICON_SIZE = 18;

/**
 * The badge's text: "Synced", "Syncing…", "Offline (3)", "Sync error", "No shared teams" (signed
 * in, nothing shared) or "Not signed in".
 */
export function syncBadgeText(t: Strings, status: SyncStatus, key: SyncStatusKey): string {
  if (key === 'offline' && status.pending > 0) {
    return t.sync.badge.offlinePending(status.pending);
  }
  return t.sync.status[key];
}

/**
 * v10: a small cloud mark with the sync state (Teams tab header, design §7.2); tap → Account.
 * Hidden while sync is off and no account is linked (the app is local-only then).
 */
export function SyncBadge() {
  const styles = useStyles();
  const t = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const status = useSyncStatus();
  const account = useSyncAccount();
  const key = useSyncStatusKey();
  if (status.phase === 'off' && !account) return null;
  const text = syncBadgeText(t, status, key);
  const isError = key === 'error';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.sync.badge.label(text)}
      onPress={() => router.push('/account')}
      testID="sync-badge"
      style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
    >
      <Ionicons
        name={ICONS[key]}
        size={ICON_SIZE}
        color={isError ? colors.error : colors.secondaryText}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.text, isError && styles.error]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  badge: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.8 },
  text: { ...typography.label, color: theme.colors.text, flexShrink: 1 },
  error: { color: theme.colors.error },
}));
