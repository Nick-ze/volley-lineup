import { Pressable, Text, View } from 'react-native';

import { CaptainBadge, Photo, PositionBadge } from '@/components';
import { fullName } from '@/domain/playerNames';
import type { Player } from '@/domain/types';
import { NumberAvatar } from '@/features/photos/NumberAvatar';
import { useT } from '@/i18n';
import { useIsCaptain } from '@/store';
import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** v8.2: the jersey number on a card without a picture, as a share of the picture's side. */
const CARD_NUMBER_SCALE = 0.36;
/** v9.1: the captain badge's diameter on a card (px). */
const CARD_CAPTAIN_SIZE = 28;

export interface PlayerCardProps {
  player: Player;
  /** The card's width in the grid. */
  width: number;
  onPress: () => void;
  /** v10: undefined for view-only members — the status is shown, not a switch. */
  onToggleActive?: () => void;
}

/**
 * v8: one player in the roster grid: picture (or the jersey number), name (first name first),
 * (v8.2: the picture fills the card's width as a square, the text sits below it)
 * number, position badges (first = primary) and the active / injured toggle. Descriptions are
 * never shown here. v9.1: the team captain has the yellow "C" badge at the picture's top right.
 */
export function PlayerCard({ player, width, onPress, onToggleActive }: PlayerCardProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.roster.roster;
  const name = fullName(player);
  const captain = useIsCaptain(player);
  const positions = player.positions.map((p) => t.positions[p]).join(', ');
  const toggleText = player.active ? s.active : s.inactive;
  // The picture spans the card inside its border; its top corners follow the card's.
  const side = Math.max(0, width - 2 * borderWidth.thin);
  const corner = Math.max(0, radius.lg - borderWidth.thin);
  return (
    <View
      style={[styles.card, !player.active && styles.cardInactive, { width }]}
      testID={`player-${player.number}-card`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.cardLabel(name, player.number, positions, player.active, captain)}
        onPress={onPress}
        testID={`player-${player.number}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View
          style={[styles.picture, { borderTopLeftRadius: corner, borderTopRightRadius: corner }]}
        >
          <Photo
            photoId={player.photoId}
            size={side}
            shape="square"
            dimmed={!player.active}
            fallback={
              <NumberAvatar
                number={player.number}
                size={side}
                shape="square"
                inactive={!player.active}
                large
                largeScale={CARD_NUMBER_SCALE}
              />
            }
          />
          {captain ? (
            <CaptainBadge
              size={CARD_CAPTAIN_SIZE}
              style={styles.captain}
              testID={`player-${player.number}-captain`}
            />
          ) : null}
        </View>
        <View style={styles.info}>
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
        </View>
      </Pressable>
      {onToggleActive ? (
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
      ) : (
        <View
          style={[styles.toggle, !player.active && styles.toggleInjured, styles.status]}
          testID={`player-${player.number}-status`}
        >
          <Text style={[styles.toggleText, !player.active && styles.toggleTextInjured]}>
            {toggleText}
          </Text>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardInactive: { borderColor: theme.colors.error },
  // Grows so the toggles of a row line up at the bottom of equally tall cards.
  main: { flexGrow: 1 },
  picture: { overflow: 'hidden' },
  captain: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  info: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  pressed: { opacity: 0.8 },
  name: { ...typography.subheading, color: theme.colors.text, textAlign: 'center' },
  number: { ...typography.label, color: theme.colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  toggle: {
    marginHorizontal: spacing.sm,
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
  // v10: the same place as the toggle, but plain text (no switch for view-only members).
  status: { borderColor: theme.colors.transparent, backgroundColor: theme.colors.transparent },
  toggleText: { ...typography.label, color: theme.colors.text },
  toggleTextInjured: { color: theme.colors.error },
}));
