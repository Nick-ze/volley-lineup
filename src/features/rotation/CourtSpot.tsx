import { StyleSheet, Text, View } from 'react-native';

import { PlayerChip } from '@/components';
import type { CourtPosition, Player } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface CourtSpotProps {
  position: CourtPosition;
  isFrontRow: boolean;
  playerId: string | null;
  player: Player | undefined;
  isServer: boolean;
  compact?: boolean;
}

const REGULAR_CHIP = 56;

/** One spot in the rotation court: position number + the player (or an empty marker). */
export function CourtSpot({
  position,
  isFrontRow,
  playerId,
  player,
  isServer,
  compact = false,
}: CourtSpotProps) {
  const row = isFrontRow ? t.rotation.frontRow : t.rotation.backRow;
  const size = compact ? touchTarget : REGULAR_CHIP;
  const testID = `spot-${position}`;

  let content;
  if (player) {
    const name = `${player.firstName} ${player.lastName}`.trim();
    const primary = player.positions[0];
    const desc = t.player.chipLabel(player.number, name, primary ? t.positions[primary] : '');
    content = (
      <PlayerChip
        player={player}
        size={size}
        highlighted={isServer}
        accessibilityLabel={t.rotation.spotLabel(position, row, desc, isServer)}
        testID={testID}
      />
    );
  } else {
    content = (
      <View
        accessible
        accessibilityLabel={
          playerId
            ? t.rotation.spotLabel(position, row, t.rotation.unknownPlayer, isServer)
            : t.rotation.emptySpotLabel(position, row)
        }
        style={[styles.empty, { width: size, height: size, borderRadius: size / 2 }]}
        testID={testID}
      >
        <Text style={styles.emptyText}>{playerId ? '?' : '–'}</Text>
      </View>
    );
  }

  return (
    <>
      <Text style={styles.posNumber} importantForAccessibility="no" accessibilityElementsHidden>
        {position}
      </Text>
      {isServer && !compact ? (
        <Text style={styles.serverTag} importantForAccessibility="no" accessibilityElementsHidden>
          {t.rotation.server}
        </Text>
      ) : null}
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  posNumber: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.sm,
    ...typography.label,
    color: colors.text,
  },
  serverTag: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    ...typography.caption,
    fontWeight: '700',
    color: colors.onHighlight,
    backgroundColor: colors.highlight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    overflow: 'hidden',
  },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...typography.subheading, color: colors.textMuted },
});
