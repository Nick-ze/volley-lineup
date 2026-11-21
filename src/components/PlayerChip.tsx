import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
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
  /** Shown and announced as disabled (presses ignored). */
  disabled?: boolean;
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
  disabled = false,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: PlayerChipProps) {
  const t = useT();
  // Settings → "Show names instead of numbers": the circle shows the name, the pill the number.
  const namesFirst = useAppStore((s) => s.chipLabel) === 'name';
  const d = Math.max(size, touchTarget);
  const shortName = player.lastName || player.firstName;
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
        {namesFirst ? (
          <Text
            style={[
              styles.nameInCircle,
              { fontSize: Math.round(d * 0.2), maxWidth: d - spacing.sm },
            ]}
            numberOfLines={2}
            testID={testID ? `${testID}-name` : undefined}
          >
            {shortName}
          </Text>
        ) : (
          <Text style={[styles.number, { fontSize: Math.round(d * 0.36) }]}>{player.number}</Text>
        )}
        {primary ? <PositionBadge position={primary} /> : null}
      </View>
      {showName ? (
        <Text style={styles.name} numberOfLines={1}>
          {namesFirst ? t.player.numberTag(player.number) : shortName}
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
      accessibilityState={{ selected, disabled }}
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
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
  nameInCircle: {
    ...typography.label,
    color: colors.text,
    textAlign: 'center',
    lineHeight: undefined,
  },
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
