import { Pressable, Text, View } from 'react-native';

import { CaptainBadge, Photo, PositionBadge } from '@/components';
import { fullName } from '@/domain/playerNames';
import type { Player } from '@/domain/types';
import { NumberAvatar } from '@/features/photos/NumberAvatar';
import { useT } from '@/i18n';
import { useIsCaptain } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** v11: the jersey number on a card without a picture, as a share of the picture's side. */
const CARD_NUMBER_SCALE = 0.72;
/** v11: height of the Active / Injured pill (px). */
const PILL_HEIGHT = 28;
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
  // The picture spans the card; the card clips its corners.
  const side = Math.max(0, width);
  return (
    <View style={[styles.card, { width }]} testID={`player-${player.number}-card`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.cardLabel(name, player.number, positions, player.active, captain)}
        onPress={onPress}
        testID={`player-${player.number}`}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <View style={styles.picture}>
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
                card
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
          <View style={styles.badges}>
            <Text style={styles.number} testID={`player-${player.number}-number`}>
              {t.player.numberTag(player.number)}
            </Text>
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
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <StatePill active={player.active} text={toggleText} />
        </Pressable>
      ) : (
        <View style={styles.toggle} testID={`player-${player.number}-status`}>
          <StatePill active={player.active} text={toggleText} />
        </View>
      )}
    </View>
  );
}

/** v11: Active / Injured as a small pill with a dot (green / red); the row around it is the target. */
function StatePill({ active, text }: { active: boolean; text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, !active && styles.dotInjured]} />
      <Text style={[styles.toggleText, !active && styles.toggleTextInjured]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  // v11: a flat panel; an injured player is told by the faded picture and the red dot.
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  // Grows so the toggles of a row line up at the bottom of equally tall cards.
  main: { flexGrow: 1 },
  picture: { overflow: 'hidden' },
  captain: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  info: { gap: spacing.xs, paddingTop: spacing.sm, paddingHorizontal: spacing.md },
  pressed: { opacity: 0.8 },
  name: { ...typography.body, fontWeight: '700', color: theme.colors.text },
  number: { ...typography.label, color: theme.colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  // The whole row is the 44 px target; the pill inside is the visible part.
  toggle: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: PILL_HEIGHT,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surfaceRaised,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: theme.colors.positive,
  },
  dotInjured: { backgroundColor: theme.colors.error },
  toggleText: { ...typography.label, color: theme.colors.text },
  toggleTextInjured: { color: theme.colors.error },
}));
