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
  /** A picture that isn't stored yet (e.g. picked in an unsaved form); wins over `photoId`. */
  uri?: string;
  /** Faded (e.g. an inactive player). */
  dimmed?: boolean;
}

/** Opacity of a dimmed picture. */
const DIMMED_OPACITY = 0.45;

/**
 * v6: a round picture of a profile or player, or the fallback when there is none. Decorative:
 * the surrounding element carries the accessibility label (name / number).
 */
export function Photo({
  photoId,
  size = touchTarget,
  fallback,
  uri: draftUri,
  dimmed = false,
}: PhotoProps) {
  const stored = usePhotoUri(draftUri === undefined ? photoId : undefined);
  const uri = draftUri ?? stored;
  if (uri === null) return <>{fallback}</>;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        dimmed && styles.dimmed,
      ]}
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
  dimmed: { opacity: DIMMED_OPACITY },
});
