import { StyleSheet, Text, View } from 'react-native';

import { Court, PlayerChip, type CourtSlotInfo } from '@/components';
import type { LiveCourtView } from '@/domain/liveSet';
import { isOffPosition } from '@/domain/roles';
import type { Player, RoleOverrides } from '@/domain/types';
import { RoleRow, SpotBadge } from '@/features/rotation/SpotTags';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { playerDescription, playerRef } from './format';
import { COURT_COLUMN_MAX_WIDTH, LIVE_CHIP_SIZE } from './layout';

export interface LiveCourtProps {
  /** Court as shown (libero swap applied) and where the libero stands in. */
  view: LiveCourtView;
  playersById: Map<string, Player>;
  /** Roles of the players on court now (`LiveState.roles`: substitutes inherit the role). */
  roles: Readonly<RoleOverrides>;
  serverId: string | null;
  /** The court player picked to go out (orange ring). */
  selectedId: string | null;
  onPressPlayer: (playerId: string) => void;
  /** No substitutions possible (e.g. the set is won): chips are shown, not tappable. */
  readOnly?: boolean;
}

/**
 * Who is on court right now with their roles on top; our server has a yellow ring and "Serving"
 * below, the libero shows "L" and "L for #n".
 * Tapping a player starts a sub; tapping the libero picks the player they stand in for.
 */
export function LiveCourt({
  view,
  playersById,
  roles,
  serverId,
  selectedId,
  onPressPlayer,
  readOnly = false,
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
        const role = id && !replacedId ? (roles[id] ?? null) : null;
        const off = !!player && isOffPosition(player, role);
        const desc = player
          ? replacedId
            ? t.rotation.liberoForLabel(
                playerDescription(t, player),
                playerRef(t, playersById, replacedId),
              )
            : role
              ? `${playerDescription(t, player)}, ${t.rotation.roleLabel(t.positions[role], off)}`
              : playerDescription(t, player)
          : '';
        return (
          <>
            <Text style={styles.pos} importantForAccessibility="no" accessibilityElementsHidden>
              {position}
            </Text>
            <RoleRow
              role={replacedId ? 'L' : player ? role : null}
              offPosition={off}
              testID={`live-role-${position}`}
            />
            {player && realId ? (
              <PlayerChip
                player={player}
                size={LIVE_CHIP_SIZE}
                highlighted={isServer}
                selected={selectedId === realId}
                onPress={readOnly ? undefined : () => onPressPlayer(realId)}
                accessibilityLabel={t.live.courtPlayerLabel(desc, position, isServer)}
                accessibilityHint={readOnly ? undefined : t.live.courtPlayerHint}
                testID={`live-court-${position}`}
              />
            ) : (
              <View accessible accessibilityLabel={t.live.emptySpot(position)}>
                <Text style={styles.empty}>{t.live.unknownPlayer}</Text>
              </View>
            )}
            {replacedId ? (
              <SpotBadge
                kind="libero"
                text={t.rotation.liberoFor(playersById.get(replacedId)?.number ?? null)}
                testID={`live-libero-tag-${position}`}
              />
            ) : (
              <SpotBadge kind="server" text={isServer ? t.live.serving : null} />
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
  empty: { ...typography.subheading, color: colors.text },
});
