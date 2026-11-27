import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTrackStyles } from '@/components';

export interface SegmentedOption<V extends string> {
  value: V;
  /** Visible text. */
  text: string;
  /** Screen-reader label; starts with the visible text. */
  label: string;
  testID: string;
}

export interface SegmentedProps<V extends string> {
  groupLabel: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  disabled?: boolean;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A row of mutually exclusive options (radio group), at least 44 px high. v11: a track with a
 * soft orange segment; while disabled (a locked set) the chosen one is grey.
 */
export function Segmented<V extends string>({
  groupLabel,
  options,
  value,
  onChange,
  disabled = false,
  hint,
  style,
}: SegmentedProps<V>) {
  const styles = useTrackStyles();
  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityHint={hint}
            accessibilityState={{ checked: active, disabled }}
            // react-native-web ignores accessibilityState: expose the state with aria-* too.
            aria-checked={active}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && (disabled ? styles.locked : styles.choice)]}
            testID={o.testID}
          >
            <Text
              style={[styles.text, disabled ? styles.textMuted : active && styles.choiceText]}
              numberOfLines={1}
            >
              {o.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
