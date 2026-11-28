import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';

import { makeStyles, useTheme } from '@/theme';

/** The corner radius of a rounded-square mark, as a share of its size (as `TeamAvatar`). */
const CORNER = 0.27;
/** The trophy's size as a share of the mark. */
const ICON = 0.5;

/** A hosted tournament's mark in a list: a quiet trophy in a rounded square (decorative). */
export function TrophyMark({ size }: { size: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.mark, { width: size, height: size, borderRadius: Math.round(size * CORNER) }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Ionicons name="trophy-outline" size={Math.round(size * ICON)} color={colors.textMuted} />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
}));
