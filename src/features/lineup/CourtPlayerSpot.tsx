import { useRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { OffPositionMark, RoleTag } from '@/components';
import { isOffPosition, roleOf } from '@/domain/roles';
import type { CourtPosition, Player } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing, touchTarget } from '@/theme';

import { COMPACT_CHIP_SIZE, ROLE_PRESS_MAX_MOVE } from './constants';
import { useDrag } from './drag/DragContext';
import { DraggablePlayer } from './drag/DraggablePlayer';
import type { LineupDraft } from './useLineupDraft';

export interface CourtPlayerSpotProps {
  editor: LineupDraft;
  player: Player;
  position: CourtPosition;
  compact: boolean;
  /** A tap on the role tag with nobody selected (acts like tapping the chip). */
  onRolePress: (player: Player) => void;
}

// Synthetic presses (tests, keyboard) may carry no coordinates: treat them as not moved.
const point = (e?: GestureResponderEvent) => ({
  x: e?.nativeEvent?.pageX ?? 0,
  y: e?.nativeEvent?.pageY ?? 0,
});

/**
 * A filled court spot: the role tag on top (its own ≥ 44 px button that acts like the chip)
 * and the draggable / tap-to-select chip below it, so neither covers the other. An off-position
 * role gets "*" at the top right of the spot (rendered into the court slot, the spot's box).
 */
export function CourtPlayerSpot({
  editor,
  player,
  position,
  compact,
  onRolePress,
}: CourtPlayerSpotProps) {
  const t = useT();
  const drag = useDrag();
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const { set, selectedId, pressPlayer, locked } = editor;
  const role = roleOf(set, player.id);
  const off = isOffPosition(player, role);
  const name = `${player.firstName} ${player.lastName}`.trim();
  const base = t.lineup.slotLabel(position, `${player.number} ${name}`);
  const label = role ? `${base}, ${t.roles.spotRole(t.positions[role], off)}` : base;

  const onRoleTagPress = (e: GestureResponderEvent) => {
    // A drag that started or ended here is not a tap.
    const start = pressStart.current;
    const end = point(e);
    const moved = start && Math.hypot(end.x - start.x, end.y - start.y) > ROLE_PRESS_MAX_MOVE;
    if (moved || drag.justDragged()) return;
    // While a player is selected, the tag acts like the spot (place / swap here).
    if (selectedId !== null) pressPlayer(player.id);
    else onRolePress(player);
  };

  return (
    <>
      {off ? <OffPositionMark testID={`role-off-${position}`} /> : null}
      <View style={styles.spot}>
        {role ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.roles.tagLabel(
              role,
              t.positions[role],
              t.roles.playerRef(player.number, name),
              off,
            )}
            accessibilityHint={
              locked
                ? t.live.lineupLocked
                : selectedId
                  ? t.lineup.slotHintSelected
                  : t.roles.tagHint
            }
            accessibilityState={{ disabled: locked }}
            aria-disabled={locked}
            disabled={locked}
            onPressIn={(e) => {
              pressStart.current = point(e);
            }}
            onPress={onRoleTagPress}
            style={({ pressed }) => [styles.tagButton, pressed && styles.pressed]}
            testID={`slot-role-${position}`}
          >
            <RoleTag role={role} testID={`role-tag-${position}`} />
          </Pressable>
        ) : (
          <View style={styles.tagButton} />
        )}
        <DraggablePlayer
          player={player}
          from={{ kind: 'slot', position }}
          selected={selectedId === player.id}
          onPress={() => pressPlayer(player.id)}
          size={compact ? COMPACT_CHIP_SIZE : undefined}
          accessibilityLabel={label}
          testID={`slot-player-${position}`}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  spot: { alignItems: 'center' },
  // The visible tag is small; the button around it keeps the 44 × 44 touch target.
  tagButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xxs,
  },
  pressed: { opacity: 0.7 },
});
