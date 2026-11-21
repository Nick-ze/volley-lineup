import { StyleSheet, Text, View } from 'react-native';

import { Court, PlayerChip, type CourtSlotInfo } from '@/components';
import type { Slots } from '@/domain/rotation';
import type { Player } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

import { playerDescription } from './format';
import { COURT_COLUMN_MAX_WIDTH, LIVE_CHIP_SIZE } from './layout';

export interface LiveCourtProps {
  slots: Slots;
  playersById: Map<string, Player>;
  serverId: string | null;
  /** The court player picked to go out (orange ring). */
  selectedId: string | null;
  onPressPlayer: (playerId: string) => void;
}

/** Who is on court right now; our server has a yellow ring, tapping a player starts a sub. */
export function LiveCourt({
  slots,
  playersById,
  serverId,
  selectedId,
  onPressPlayer,
}: LiveCourtProps) {
  const slotStyle = ({ isFrontRow }: CourtSlotInfo) => (isFrontRow ? styles.front : styles.back);
  return (
    <Court
      testID="live-court"
      showPositionNumbers={false}
      style={styles.court}
      slotStyle={slotStyle}
      renderSlot={({ position }) => {
        const id = slots[position];
        const player = id ? playersById.get(id) : undefined;
        const isServer = !!id && id === serverId;
        return (
          <>
            <Text style={styles.pos} importantForAccessibility="no" accessibilityElementsHidden>
              {position}
            </Text>
            {isServer ? (
              <Text style={styles.tag} importantForAccessibility="no" accessibilityElementsHidden>
                {t.live.serving}
              </Text>
            ) : null}
            {player ? (
              <PlayerChip
                player={player}
                size={LIVE_CHIP_SIZE}
                highlighted={isServer}
                selected={selectedId === player.id}
                onPress={() => onPressPlayer(player.id)}
                accessibilityLabel={t.live.courtPlayerLabel(
                  playerDescription(player),
                  position,
                  isServer,
                )}
                accessibilityHint={t.live.courtPlayerHint}
                testID={`live-court-${position}`}
              />
            ) : (
              <View accessible accessibilityLabel={t.live.emptySpot(position)}>
                <Text style={styles.empty}>{t.live.unknownPlayer}</Text>
              </View>
            )}
          </>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  court: { maxWidth: COURT_COLUMN_MAX_WIDTH },
  // White text on these fills passes AA (white directly on orange does not).
  front: { backgroundColor: colors.secondary },
  back: { backgroundColor: colors.overlay },
  pos: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.sm,
    ...typography.label,
    color: colors.text,
  },
  tag: {
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
  empty: { ...typography.subheading, color: colors.text },
});
