import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { usePhotoUri } from '@/store/photoStore';
import { radius, touchTarget } from '@/theme';

export interface PhotoProps {
  /** The profile's / player's `photoId`; without one (or before it has loaded) the fallback. */
  photoId: string | undefined;
  /** Diameter in px (default 44). */
  size?: number;
  /** Shown without a photo: the profile avatar or the jersey number. */
  fallback: ReactNode;
}

/**
 * v6: a round picture of a profile or player, or the fallback when there is none. Decorative:
 * the surrounding element carries the accessibility label (name / number).
 */
export function Photo({ photoId, size = touchTarget, fallback }: PhotoProps) {
  const uri = usePhotoUri(photoId);
  if (uri === null) return <>{fallback}</>;
  return (
    <View
      style={[styles.circle, { width: size, height: size }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="photo"
    >
      <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.round, overflow: 'hidden' },
});
