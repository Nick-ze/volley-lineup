import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTrackStyles } from '@/components';
import { makeStyles } from '@/theme';

export interface StackedOption<V extends string> {
  value: V;
  /** Visible text; also the accessible name. */
  text: string;
  testID: string;
}

export interface StackedChoiceProps<V extends string> {
  groupLabel: string;
  options: readonly StackedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Mutually exclusive options one below the other, each as wide as the track: for options whose
 * text is a short sentence ("Alle Sätze werden gespielt" doesn't fit half a phone's width). Same
 * look as the app's other tracks: the chosen one is soft orange.
 */
export function StackedChoice<V extends string>({
  groupLabel,
  options,
  value,
  onChange,
  style,
}: StackedChoiceProps<V>) {
  const track = useTrackStyles();
  const styles = useStyles();
  return (
    <View
      style={[track.track, styles.column, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.text}
            accessibilityState={{ checked: active }}
            // react-native-web ignores accessibilityState: expose the state with aria-* too.
            aria-checked={active}
            onPress={() => onChange(o.value)}
            style={[track.segment, styles.row, active && track.choice]}
            testID={o.testID}
          >
            <Text style={[track.text, active && track.choiceText]}>{o.text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  column: { flexDirection: 'column' },
  // In a column the segment's height comes from its content, not from an equal share.
  row: { flexGrow: 0, flexBasis: 'auto' },
}));
