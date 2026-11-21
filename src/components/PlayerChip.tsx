import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { PositionBadge } from './PositionBadge';

export interface PlayerChipProps {
  player: Player;
  /** Diameter of the round chip. Never below the 44 px touch target. */
  size?: number;
  selected?: boolean;
  /** e.g. the server in the rotation viewer (yellow ring). */
  highlighted?: boolean;
  /** Visually "lifted" (drag in progress). */
  lifted?: boolean;
  showName?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function PlayerChip({
  player,
  size = 64,
  selected = false,
  highlighted = false,
  lifted = false,
  showName = true,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: PlayerChipProps) {
  const t = useT();
  const d = Math.max(size, touchTarget);
  const primary = player.positions[0];
  const label =
    accessibilityLabel ??
    t.player.chipLabel(
      player.number,
      `${player.firstName} ${player.lastName}`,
      primary ? t.positions[primary] : '',
    );
  const ringColor = selected ? colors.primary : highlighted ? colors.highlight : colors.border;

  const content = (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.circle,
          { width: d, height: d, borderRadius: d / 2, borderColor: ringColor },
          (selected || highlighted) && styles.ringThick,
          lifted && styles.lifted,
        ]}
      >
        <Text style={[styles.number, { fontSize: Math.round(d * 0.36) }]}>{player.number}</Text>
        {primary ? <PositionBadge position={primary} /> : null}
      </View>
      {showName ? (
        <Text style={styles.name} numberOfLines={1}>
          {player.lastName || player.firstName}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress && !onLongPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      hitSlop={spacing.xs}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: spacing.xxs },
  circle: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  ringThick: { borderWidth: 3 },
  lifted: {
    transform: [{ scale: 1.15 }],
    shadowColor: colors.highlight,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  number: { ...typography.jersey, color: colors.text, lineHeight: undefined },
  // Dark pill behind the name so it stays AA-readable on the orange court (white on orange ≈ 2.9:1).
  name: {
    ...typography.caption,
    color: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xs,
    maxWidth: 88,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
