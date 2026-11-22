import { Court, type CourtSlotInfo } from '@/components';
import type { LiberoSwap } from '@/domain/liberoSwap';
import { isOffPosition } from '@/domain/roles';
import { serverPosition, type Slots } from '@/domain/rotation';
import type { CourtPosition, Player, Position } from '@/domain/types';
import { makeStyles, spacing } from '@/theme';

import { CourtSpot } from './CourtSpot';
import { COMPACT_COURT_MAX_WIDTH, COMPACT_SLOT_MIN_HEIGHT } from './layout';

export interface RotationCourtProps {
  slots: Slots;
  playersById: Map<string, Player>;
  /**
   * Role of every spot (v6: from the formation, e.g. `spotRoles` / `stepSpotRoles`), shown also
   * on empty spots; none = no tags.
   */
  spotRoles?: Readonly<Record<CourtPosition, Position>>;
  /** Highlight the server at position 1 (default true). */
  highlightServer?: boolean;
  compact?: boolean;
  /** Where the libero stands in for a starter (already applied to `slots`). */
  liberoSwap?: LiberoSwap | null;
  testID?: string;
}

/** The shared Court (role tags on top of each spot) with the front row tinted blue, the back row dark and the server in yellow. */
export function RotationCourt({
  slots,
  playersById,
  spotRoles,
  highlightServer = true,
  compact = false,
  liberoSwap = null,
  testID,
}: RotationCourtProps) {
  const styles = useStyles();
  const slotStyle = ({ isFrontRow }: CourtSlotInfo) => [
    isFrontRow ? styles.front : styles.back,
    styles.slot,
    compact && styles.compactSlot,
  ];
  return (
    <Court
      testID={testID}
      showPositionNumbers={false}
      style={compact ? styles.compactCourt : undefined}
      slotStyle={slotStyle}
      renderSlot={({ position, isFrontRow }) => {
        const playerId = slots[position];
        const player = playerId ? playersById.get(playerId) : undefined;
        const role = spotRoles?.[position] ?? null;
        return (
          <CourtSpot
            position={position}
            isFrontRow={isFrontRow}
            playerId={playerId}
            player={player}
            role={role}
            offPosition={!!player && isOffPosition(player, role)}
            isServer={highlightServer && position === serverPosition}
            compact={compact}
            liberoFor={
              liberoSwap?.position === position
                ? { replaced: playersById.get(liberoSwap.replacedId) }
                : undefined
            }
          />
        );
      }}
    />
  );
}

const useStyles = makeStyles((theme) => ({
  // White text on these fills passes WCAG AA (white directly on orange #FF6B00 is ≈ 2.9:1).
  front: { backgroundColor: theme.colors.secondary },
  back: { backgroundColor: theme.colors.overlay },
  // The role row takes the room of the default vertical padding (the court keeps its height).
  slot: { paddingVertical: spacing.xxs },
  compactSlot: { minHeight: COMPACT_SLOT_MIN_HEIGHT },
  compactCourt: { maxWidth: COMPACT_COURT_MAX_WIDTH },
}));
