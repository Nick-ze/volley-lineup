import { Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import {
  borderWidth,
  fontSize,
  inlineFontSize,
  makeStyles,
  spacing,
  typography,
  useTheme,
} from '@/theme';

import { Photo } from './Photo';
import { PositionBadge } from './PositionBadge';

/** Room between a chip's picture and its outer edge: the thick selection ring on both sides. */
const PHOTO_INSET = 2 * borderWidth.thick;
/** v8.4: opacity of the faded picture behind a court chip's number / name (the text stays readable). */
const BACKDROP_OPACITY = 0.3;

export interface PlayerChipFaceProps {
  player: Player;
  /** v8: the short name shown with names on ("Anna", "Anna M."). */
  name: string;
  /** Diameter in px (already at least the touch target). */
  diameter: number;
  /** The player's picture to show, or null for the number / name. */
  photoUri: string | null;
  /** v8.4: the player's picture shown faded behind the number / name (court chips), or null. */
  backdropUri?: string | null;
  /** Settings → "Prioritise names". */
  namesFirst: boolean;
  ringColor: string;
  thickRing: boolean;
  lifted: boolean;
  /** For the name text (`<testID>-name`). */
  testID?: string;
}

/** The round part of a `PlayerChip`: photo, number or name, and the primary position badge. */
export function PlayerChipFace({
  player,
  name,
  diameter: d,
  photoUri,
  backdropUri = null,
  namesFirst,
  ringColor,
  thickRing,
  lifted,
  testID,
}: PlayerChipFaceProps) {
  const styles = useStyles();
  const { fonts } = useTheme();
  const primary = player.positions[0];
  return (
    <View
      style={[
        styles.circle,
        { width: d, height: d, borderRadius: d / 2, borderColor: ringColor },
        thickRing && styles.ringThick,
        lifted && styles.lifted,
      ]}
    >
      {photoUri === null && backdropUri !== null ? (
        <View style={styles.backdrop} testID={testID ? `${testID}-backdrop` : undefined}>
          <Photo
            photoId={player.photoId}
            uri={backdropUri}
            size={d - PHOTO_INSET}
            fallback={null}
          />
        </View>
      ) : null}
      {photoUri !== null ? (
        <Photo photoId={player.photoId} uri={photoUri} size={d - PHOTO_INSET} fallback={null} />
      ) : namesFirst ? (
        <Text
          style={[
            styles.nameInCircle,
            // Never below the caption size; narrower than the circle so text stays inside it.
            {
              ...inlineFontSize(Math.max(fontSize.xs, Math.round(d * 0.2)), fonts),
              maxWidth: Math.round(d * 0.8),
            },
          ]}
          numberOfLines={2}
          testID={testID ? `${testID}-name` : undefined}
        >
          {name}
        </Text>
      ) : (
        <Text style={[styles.number, inlineFontSize(Math.round(d * 0.36), fonts)]}>
          {player.number}
        </Text>
      )}
      {primary ? (
        <View style={photoUri !== null && styles.badgeOnPhoto}>
          <PositionBadge position={primary} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  circle: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  ringThick: { borderWidth: borderWidth.thick },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: BACKDROP_OPACITY,
  },
  badgeOnPhoto: { position: 'absolute', bottom: spacing.xxs },
  lifted: {
    transform: [{ scale: 1.15 }],
    shadowColor: theme.colors.highlight,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  number: { ...typography.jersey, color: theme.colors.text, lineHeight: undefined },
  nameInCircle: {
    ...typography.label,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: undefined,
  },
}));
