import { Pressable, Text, View } from 'react-native';

import { Photo, PositionBadge } from '@/components';
import { fullName } from '@/domain/playerNames';
import type { Player } from '@/domain/types';
import { NumberAvatar } from '@/features/photos/NumberAvatar';
import { useT } from '@/i18n';
import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** Diameter of the picture (or the big jersey number) on a card. */
export const CARD_PHOTO_SIZE = 88;

export interface PlayerCardProps {
  player: Player;
  /** The card's width in the grid. */
  width: number;
  onPress: () => void;
  onToggleActive: () => void;
}

/**
 * v8: one player in the roster grid: picture (or the jersey number), name (first name first),
 * number, position badges (first = primary) and the active / injured toggle. Descriptions are
 * never shown here.
 */
export function PlayerCard({ player, width, onPress, onToggleActive }: PlayerCardProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.roster.roster;
  const name = fullName(player);
  const positions = player.positions.map((p) => t.positions[p]).join(', ');
  const toggleText = player.active ? s.active : s.inactive;
  return (
    <View
      style={[styles.card, !player.active && styles.cardInactive, { width }]}
      testID={`player-${player.number}-card`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.cardLabel(name, player.number, positions, player.active)}
        onPress={onPress}
        testID={`player-${player.number}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Photo
          photoId={player.photoId}
          size={CARD_PHOTO_SIZE}
          dimmed={!player.active}
          fallback={
            <NumberAvatar
              number={player.number}
              size={CARD_PHOTO_SIZE}
              inactive={!player.active}
              large
            />
          }
        />
        <Text style={styles.name} numberOfLines={2} testID={`player-${player.number}-name`}>
          {name}
        </Text>
        <Text style={styles.number} testID={`player-${player.number}-number`}>
          {t.player.numberTag(player.number)}
        </Text>
        <View style={styles.badges}>
          {player.positions.map((p) => (
            <PositionBadge key={p} position={p} />
          ))}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={s.toggleActive(name, player.active)}
        accessibilityState={{ checked: player.active }}
        aria-checked={player.active}
        onPress={onToggleActive}
        testID={`player-${player.number}-active`}
        style={({ pressed }) => [
          styles.toggle,
          !player.active && styles.toggleInjured,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.toggleText, !player.active && styles.toggleTextInjured]}>
          {toggleText}
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: theme.colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  cardInactive: { borderColor: theme.colors.error },
  main: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs },
  pressed: { opacity: 0.8 },
  name: { ...typography.subheading, color: theme.colors.text, textAlign: 'center' },
  number: { ...typography.label, color: theme.colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  toggle: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
  },
  toggleInjured: { borderColor: theme.colors.error, backgroundColor: theme.colors.transparent },
  toggleText: { ...typography.label, color: theme.colors.text },
  toggleTextInjured: { color: theme.colors.error },
}));
