import { StyleSheet, Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import { borderWidth, colors, fontSize, spacing, typography } from '@/theme';

import { Photo } from './Photo';
import { PositionBadge } from './PositionBadge';

/** Room between a chip's picture and its outer edge: the thick selection ring on both sides. */
const PHOTO_INSET = 2 * borderWidth.thick;

export interface PlayerChipFaceProps {
  player: Player;
  /** Diameter in px (already at least the touch target). */
  diameter: number;
  /** The player's picture to show, or null for the number / name. */
  photoUri: string | null;
  /** Settings → "Show names instead of numbers". */
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
  diameter: d,
  photoUri,
  namesFirst,
  ringColor,
  thickRing,
  lifted,
  testID,
}: PlayerChipFaceProps) {
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
      {photoUri !== null ? (
        <Photo photoId={player.photoId} uri={photoUri} size={d - PHOTO_INSET} fallback={null} />
      ) : namesFirst ? (
        <Text
          style={[
            styles.nameInCircle,
            // Never below the caption size; narrower than the circle so text stays inside it.
            {
              fontSize: Math.max(fontSize.xs, Math.round(d * 0.2)),
              maxWidth: Math.round(d * 0.8),
            },
          ]}
          numberOfLines={2}
          testID={testID ? `${testID}-name` : undefined}
        >
          {player.lastName || player.firstName}
        </Text>
      ) : (
        <Text style={[styles.number, { fontSize: Math.round(d * 0.36) }]}>{player.number}</Text>
      )}
      {primary ? (
        <View style={photoUri !== null && styles.badgeOnPhoto}>
          <PositionBadge position={primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  ringThick: { borderWidth: borderWidth.thick },
  badgeOnPhoto: { position: 'absolute', bottom: spacing.xxs },
  lifted: {
    transform: [{ scale: 1.15 }],
    shadowColor: colors.highlight,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  number: { ...typography.jersey, color: colors.text, lineHeight: undefined },
  nameInCircle: {
    ...typography.label,
    color: colors.text,
    textAlign: 'center',
    lineHeight: undefined,
  },
});
