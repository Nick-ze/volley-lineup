import { StyleSheet, Text, View } from 'react-native';

import { Photo } from '@/components';
import { colors, radius, touchTarget, typography } from '@/theme';

/** Round coloured circle with the name's first letter (a profile without a photo). */
export function LetterAvatar({
  name,
  color,
  size = touchTarget,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.circle,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={styles.letter}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

/** A profile's photo, or the round avatar in the profile colour with the first letter. */
export function Avatar({
  name,
  color,
  photoId,
  size = touchTarget,
}: {
  name: string;
  color: string;
  photoId?: string;
  size?: number;
}) {
  return (
    <Photo
      photoId={photoId}
      size={size}
      fallback={<LetterAvatar name={name} color={color} size={size} />}
    />
  );
}

const styles = StyleSheet.create({
  circle: { borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  // All profile colours are light/bright enough for near-black text (AA).
  letter: { ...typography.subheading, color: colors.onPrimary },
});
