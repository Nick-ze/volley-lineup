import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { usePhotoUri } from '@/store/photoStore';
import { touchTarget } from '@/theme';

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
  /**
   * v8.2: `circle` (default) or `square` — the whole picture as a square with `cornerRadius`
   * (the roster cards show players' pictures in full).
   */
  shape?: 'circle' | 'square';
  /** Corner radius of a `square` picture (default 0). */
  cornerRadius?: number;
}

/** Opacity of a dimmed picture. */
const DIMMED_OPACITY = 0.45;

/**
 * v6: a round (v8.2: or square) picture of a profile or player, or the fallback when there is none. Decorative:
 * the surrounding element carries the accessibility label (name / number).
 */
export function Photo({
  photoId,
  size = touchTarget,
  fallback,
  uri: draftUri,
  dimmed = false,
  shape = 'circle',
  cornerRadius = 0,
}: PhotoProps) {
  const stored = usePhotoUri(draftUri === undefined ? photoId : undefined);
  const uri = draftUri ?? stored;
  if (uri === null) return <>{fallback}</>;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: shape === 'circle' ? size / 2 : cornerRadius },
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
  circle: { overflow: 'hidden' },
  dimmed: { opacity: DIMMED_OPACITY },
});
