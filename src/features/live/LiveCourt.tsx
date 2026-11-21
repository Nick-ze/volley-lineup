import { StyleSheet, Text, View } from 'react-native';

import { Court, PlayerChip, type CourtSlotInfo } from '@/components';
import type { LiveCourtView } from '@/domain/liveSet';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import { playerDescription, playerRef } from './format';
import { COURT_COLUMN_MAX_WIDTH, LIVE_CHIP_SIZE } from './layout';

export interface LiveCourtProps {
  /** Court as shown (libero swap applied) and where the libero stands in. */
  view: LiveCourtView;
  playersById: Map<string, Player>;
  serverId: string | null;
  /** The court player picked to go out (orange ring). */
  selectedId: string | null;
  onPressPlayer: (playerId: string) => void;
}

/**
 * Who is on court right now; our server has a yellow ring, the libero is tagged "L for #n".
 * Tapping a player starts a sub; tapping the libero picks the player they stand in for.
 */
export function LiveCourt({
  view,
  playersById,
  serverId,
  selectedId,
  onPressPlayer,
}: LiveCourtProps) {
  const t = useT();
  const slotStyle = ({ isFrontRow }: CourtSlotInfo) => (isFrontRow ? styles.front : styles.back);
  const { slots, liberoSwap } = view;
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
        const replacedId = liberoSwap?.position === position ? liberoSwap.replacedId : null;
        // The real player at this spot: the libero acts for the starter they replace.
        const realId = replacedId ?? id;
        const desc = player
          ? replacedId
            ? t.rotation.liberoForLabel(
                playerDescription(t, player),
                playerRef(t, playersById, replacedId),
              )
            : playerDescription(t, player)
          : '';
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
            {replacedId ? (
              <Text
                style={[styles.tag, styles.liberoTag]}
                importantForAccessibility="no"
                accessibilityElementsHidden
                testID={`live-libero-tag-${position}`}
              >
                {t.rotation.liberoFor(playersById.get(replacedId)?.number ?? null)}
              </Text>
            ) : null}
            {player && realId ? (
              <PlayerChip
                player={player}
                size={LIVE_CHIP_SIZE}
                highlighted={isServer}
                selected={selectedId === realId}
                onPress={() => onPressPlayer(realId)}
                accessibilityLabel={t.live.courtPlayerLabel(desc, position, isServer)}
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
  // Same look as the rotation viewer's "L for #n" tag (near-black on white).
  liberoTag: { color: colors.onPrimary, backgroundColor: colors.text },
  empty: { ...typography.subheading, color: colors.text },
});
