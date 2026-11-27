import { Text, View } from 'react-native';

import { Photo } from '@/components/Photo';
import type { Player } from '@/domain/types';
import { makeStyles, radius, touchTarget, typography } from '@/theme';

/** The player's photo, or their jersey number in a circle. Decorative (the row is labelled). */
export function PlayerAvatar({ player, size = touchTarget }: { player: Player; size?: number }) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  circle: {
    borderRadius: radius.round,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { ...typography.subheading, color: theme.colors.text },
}));
