import { Pressable, Text, View } from 'react-native';

import { POINT_BUTTON_MIN_HEIGHT } from '@/features/live/layout';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

export interface LivePointButtonsProps {
  teamA: string;
  teamB: string;
  onPoint: (team: 'a' | 'b') => void;
  disabled?: boolean;
}

/**
 * v12.2: the two large rally buttons of a tournament match — orange for the first team, blue for
 * the second (the live mode's two colours), each with "Point" above the team's name.
 */
export function LivePointButtons({
  teamA,
  teamB,
  onPoint,
  disabled = false,
}: LivePointButtonsProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.live;
  const button = (team: 'a' | 'b', name: string) => {
    const first = team === 'a';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.pointLabel(name)}
        accessibilityState={{ disabled }}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => onPoint(team)}
        testID={`live-point-${team}`}
        style={({ pressed }) => [
          styles.button,
          first ? styles.first : styles.second,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.point, first ? styles.firstText : styles.secondText]}>{s.point}</Text>
        <Text style={[styles.name, first ? styles.firstText : styles.secondText]} numberOfLines={2}>
          {name}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.row}>
      {button('a', teamA)}
      {button('b', teamB)}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', gap: spacing.md },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: POINT_BUTTON_MIN_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  first: { backgroundColor: theme.colors.primary },
  second: { backgroundColor: theme.colors.secondary },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  point: { ...typography.displayM, textAlign: 'center' },
  name: { ...typography.label, fontWeight: '700', textAlign: 'center' },
  firstText: { color: theme.colors.onPrimary },
  secondText: { color: theme.colors.onSecondary },
}));
