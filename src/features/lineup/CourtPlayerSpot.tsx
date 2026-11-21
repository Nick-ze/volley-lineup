import { Pressable, StyleSheet, View } from 'react-native';

import { RoleTag } from '@/components';
import { isOffPosition, roleOf } from '@/domain/roles';
import type { CourtPosition, Player } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing, touchTarget } from '@/theme';

import { COMPACT_CHIP_SIZE } from './constants';
import { DraggablePlayer } from './drag/DraggablePlayer';
import type { LineupDraft } from './useLineupDraft';

export interface CourtPlayerSpotProps {
  editor: LineupDraft;
  player: Player;
  position: CourtPosition;
  compact: boolean;
  /** Opens the role picker for this player. */
  onRolePress: (player: Player) => void;
}

/**
 * A filled court spot: the role tag on top (its own ≥ 44 px button that opens the role picker)
 * and the draggable / tap-to-select chip below it, so neither covers the other.
 */
export function CourtPlayerSpot({
  editor,
  player,
  position,
  compact,
  onRolePress,
}: CourtPlayerSpotProps) {
  const t = useT();
  const { set, selectedId, pressPlayer, locked } = editor;
  const role = roleOf(set.roles, player);
  const off = isOffPosition(player, role);
  const name = `${player.firstName} ${player.lastName}`.trim();
  const base = t.lineup.slotLabel(position, `${player.number} ${name}`);
  const label = role ? `${base}, ${t.roles.spotRole(t.positions[role], off)}` : base;

  return (
    <View style={styles.spot}>
      {role ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.roles.tagLabel(
            role,
            t.positions[role],
            `#${player.number} ${name}`,
            off,
          )}
          accessibilityHint={locked ? t.live.lineupLocked : t.roles.tagHint}
          accessibilityState={{ disabled: locked }}
          aria-disabled={locked}
          disabled={locked}
          onPress={() => onRolePress(player)}
          style={({ pressed }) => [styles.tagButton, pressed && styles.pressed]}
          testID={`slot-role-${position}`}
        >
          <RoleTag role={role} offPosition={off} testID={`role-tag-${position}`} />
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
