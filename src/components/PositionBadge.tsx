import { Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { makeStyles, radius, spacing, typography, useTheme } from '@/theme';

export function PositionBadge({ position }: { position: Position }) {
  const { positionColors } = useTheme();
  const styles = useStyles();
  const c = positionColors[position];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{position}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    // Light mode: a thin edge so light badges (libero, setter) show on white; the padding
    // gives up the border's room so the badge keeps its size.
    ...(theme.scheme === 'light' && {
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: spacing.xs - 1,
      paddingVertical: 0,
    }),
    borderRadius: radius.sm,
    minWidth: 22,
    alignItems: 'center',
  },
  text: { ...typography.caption, fontWeight: '700' },
}));
