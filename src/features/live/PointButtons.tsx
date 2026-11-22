import { Pressable, Text, View } from 'react-native';

import type { Side } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing } from '@/theme';

import {
  POINT_BUTTON_COMPACT_MIN_HEIGHT,
  POINT_BUTTON_FONT_SIZE,
  POINT_BUTTON_MIN_HEIGHT,
} from './layout';

export interface PointButtonsProps {
  opponent: string;
  onPoint: (winner: Side) => void;
  /** Lower buttons (still far above 44 px), used while the serve toggle is shown above them. */
  compact?: boolean;
}

/** The two large rally buttons: orange "Point us", blue "Point them". */
export function PointButtons({ opponent, onPoint, compact = false }: PointButtonsProps) {
  const styles = useStyles();
  const t = useT();
  const button = (side: Side, label: string, a11y: string) => {
    const us = side === 'us';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => onPoint(side)}
        testID={`point-${side}`}
        style={({ pressed }) => [
          styles.button,
          compact && styles.compact,
          us ? styles.us : styles.them,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.label, us ? styles.usLabel : styles.themLabel]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.row}>
      {button('us', t.live.pointUs, t.live.pointUsLabel)}
      {button('them', t.live.pointThem, t.live.pointThemLabel(opponent))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    minHeight: POINT_BUTTON_MIN_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  compact: { minHeight: POINT_BUTTON_COMPACT_MIN_HEIGHT },
  us: { backgroundColor: theme.colors.primary },
  // White on volleyball blue #0057B8 ≈ 6.9:1 (AA).
  them: { backgroundColor: theme.colors.secondary },
  pressed: { opacity: 0.8 },
  label: { fontSize: POINT_BUTTON_FONT_SIZE, fontWeight: '800', textAlign: 'center' },
  usLabel: { color: theme.colors.onPrimary },
  themLabel: { color: theme.colors.onSecondary },
}));
