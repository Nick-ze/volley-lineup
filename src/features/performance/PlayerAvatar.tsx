import { StyleSheet, Text, View } from 'react-native';

import { Photo } from '@/components/Photo';
import type { Player } from '@/domain/types';
import { colors, radius, touchTarget, typography } from '@/theme';

/** The player's photo, or their jersey number in a circle. Decorative (the row is labelled). */
export function PlayerAvatar({ player, size = touchTarget }: { player: Player; size?: number }) {
  return (
    <Photo
      photoId={player.photoId}
      size={size}
      fallback={
        <View
          style={[styles.circle, { width: size, height: size }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Text style={styles.number}>{player.number}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.round,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { ...typography.subheading, color: colors.text },
});
