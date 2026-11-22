import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

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

/** A row of mutually exclusive options (radio group), at least 44 px high. */
export function Segmented<V extends string>({
  groupLabel,
  options,
  value,
  onChange,
  disabled = false,
  hint,
  style,
}: SegmentedProps<V>) {
  const styles = useStyles();
  return (
    <View
      style={[styles.row, disabled && styles.disabled, style]}
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
            style={[styles.option, active && styles.active]}
            testID={o.testID}
          >
            <Text style={[styles.text, active && styles.activeText]} numberOfLines={1}>
              {o.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  disabled: { opacity: 0.6 },
  option: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: theme.colors.surface,
  },
  active: { backgroundColor: theme.colors.primary },
  text: { ...typography.label, color: theme.colors.text, textAlign: 'center' },
  activeText: { color: theme.colors.onPrimary },
}));
