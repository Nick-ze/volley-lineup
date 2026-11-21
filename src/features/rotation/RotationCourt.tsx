import { StyleSheet } from 'react-native';

import { Court, type CourtSlotInfo } from '@/components';
import type { LiberoSwap } from '@/domain/liberoSwap';
import { serverPosition, type Slots } from '@/domain/rotation';
import type { Player } from '@/domain/types';
import { colors } from '@/theme';

import { CourtSpot } from './CourtSpot';
import { COMPACT_COURT_MAX_WIDTH, COMPACT_SLOT_MIN_HEIGHT } from './layout';

export interface RotationCourtProps {
  slots: Slots;
  playersById: Map<string, Player>;
  /** Highlight the server at position 1 (default true). */
  highlightServer?: boolean;
  compact?: boolean;
  /** Where the libero stands in for a starter (already applied to `slots`). */
  liberoSwap?: LiberoSwap | null;
  testID?: string;
}

/** The shared Court with the front row tinted blue, the back row dark and the server in yellow. */
export function RotationCourt({
  slots,
  playersById,
  highlightServer = true,
  compact = false,
  liberoSwap = null,
  testID,
}: RotationCourtProps) {
  const slotStyle = ({ isFrontRow }: CourtSlotInfo) => [
    isFrontRow ? styles.front : styles.back,
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
        return (
          <CourtSpot
            position={position}
            isFrontRow={isFrontRow}
            playerId={playerId}
            player={playerId ? playersById.get(playerId) : undefined}
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

const styles = StyleSheet.create({
  // White text on these fills passes WCAG AA (white directly on orange #FF6B00 is ≈ 2.9:1).
  front: { backgroundColor: colors.secondary },
  back: { backgroundColor: colors.overlay },
  compactSlot: { minHeight: COMPACT_SLOT_MIN_HEIGHT },
  compactCourt: { maxWidth: COMPACT_COURT_MAX_WIDTH },
});
