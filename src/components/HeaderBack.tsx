import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useT } from '@/i18n';
import { colors, spacing, touchTarget, typography } from '@/theme';

/**
 * Header back button (≥ 44×44). Goes back when there is history; after a reload or deep link
 * (no history) it navigates to the screen's logical parent instead.
 */
export function HeaderBack({ fallback }: { fallback: Href }) {
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
      <Text style={styles.label}>{t.common.backWithChevron}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  label: { ...typography.body, color: colors.text },
});
