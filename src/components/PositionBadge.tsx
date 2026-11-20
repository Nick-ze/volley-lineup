import { StyleSheet, Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { radius, spacing, typography, positionColors } from '@/theme';

export function PositionBadge({ position }: { position: Position }) {
  const c = positionColors[position];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{position}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.sm,
    minWidth: 22,
    alignItems: 'center',
  },
  text: { ...typography.caption, fontWeight: '700' },
});
