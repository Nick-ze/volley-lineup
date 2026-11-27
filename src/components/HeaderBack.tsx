import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, useTheme } from '@/theme';

/** Diameter of the round mark inside the 44 px touch target. */
const CIRCLE = touchTarget - spacing.xs;
const ICON_SIZE = 22;

/**
 * Header back button (v11: a round button; the touch target is 44×44). Goes back when there is
 * history; after a reload or deep link (no history) it navigates to the screen's logical parent
 * instead.
 */
export function HeaderBack({ fallback }: { fallback: Href }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const t = useT();
  const router = useRouter();
  const onPress = () => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.common.back}
      onPress={onPress}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="header-back"
    >
      <View style={styles.circle}>
        <Ionicons name="chevron-back" size={ICON_SIZE} color={colors.text} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  button: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.round,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
}));
