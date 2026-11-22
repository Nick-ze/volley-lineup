import { Text, View } from 'react-native';

import { PlayerChip } from '@/components';
import type { CourtPosition, Player, Position } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { CHIP_SIZE, COMPACT_CHIP_SIZE } from './layout';
import { ChipWithBadge, RoleRow } from './SpotTags';

export interface CourtSpotProps {
  position: CourtPosition;
  isFrontRow: boolean;
  playerId: string | null;
  player: Player | undefined;
  isServer: boolean;
  compact?: boolean;
  /** Set when the libero stands here: the starter they replace (undefined if unknown). */
  liberoFor?: { replaced: Player | undefined };
  /** The role of this spot (v6: from the formation, also when empty), or null. The libero is always "L". */
  role?: Position | null;
  /** The role is none of the player's positions ("*"). */
  offPosition?: boolean;
}

/** One spot in the rotation court: position number, role tag, the player (or an empty marker). */
export function CourtSpot({
  position,
  isFrontRow,
  playerId,
  player,
  isServer,
  compact = false,
  liberoFor,
  role = null,
  offPosition = false,
}: CourtSpotProps) {
  const styles = useStyles();
  const t = useT();
  const row = isFrontRow ? t.rotation.frontRow : t.rotation.backRow;
  const size = compact ? COMPACT_CHIP_SIZE : CHIP_SIZE;
  const testID = `spot-${position}`;
  const shownRole = liberoFor ? 'L' : role;

  let content;
  if (player) {
    const name = `${player.firstName} ${player.lastName}`.trim();
    const primary = player.positions[0];
    const chip = t.player.chipLabel(player.number, name, primary ? t.positions[primary] : '');
    const desc = liberoFor
      ? t.rotation.liberoForLabel(chip, describe(t, liberoFor.replaced))
      : role
        ? `${chip}, ${t.roles.spotRole(t.positions[role], offPosition)}`
        : chip;
    const badge = compact
      ? null
      : liberoFor
        ? t.rotation.liberoFor(liberoFor.replaced?.number ?? null)
        : isServer
          ? t.rotation.server
          : null;
    content = (
      <ChipWithBadge
        chipSize={size}
        text={badge}
        kind={liberoFor ? 'libero' : 'server'}
        testID={liberoFor ? `libero-tag-${position}` : undefined}
      >
        <PlayerChip
          player={player}
          size={size}
          highlighted={isServer}
          accessibilityLabel={t.rotation.spotLabel(position, row, desc, isServer)}
          testID={testID}
        />
      </ChipWithBadge>
    );
  } else {
    content = (
      <View
        accessible
        accessibilityLabel={
          playerId
            ? t.rotation.spotLabel(
                position,
                row,
                role
                  ? `${t.rotation.unknownPlayer}, ${t.roles.spotRole(t.positions[role], false)}`
                  : t.rotation.unknownPlayer,
                isServer,
              )
            : t.rotation.emptySpotLabel(position, row, role ? t.positions[role] : null)
        }
        style={[styles.empty, { width: size, height: size, borderRadius: size / 2 }]}
        testID={testID}
      >
        <Text style={styles.emptyText}>
          {playerId ? t.rotation.unknownGlyph : t.rotation.emptyGlyph}
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* v8: the spot's number is drawn by RotationCourt (it stays put while players slide). */}
      <RoleRow
        role={shownRole}
        offPosition={!liberoFor && offPosition}
        testID={`role-tag-${position}`}
      />
      {content}
    </>
  );
}

function describe(t: Strings, player: Player | undefined): string {
  if (!player) return t.rotation.unknownPlayer;
  return t.rotation.playerSummary(player.number, `${player.firstName} ${player.lastName}`.trim());
}

const useStyles = makeStyles((theme) => ({
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    // White passes AA on both the blue (front) and dark (back) slot fills.
    borderColor: theme.colors.onSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { ...typography.subheading, color: theme.colors.onSecondary },
}));
