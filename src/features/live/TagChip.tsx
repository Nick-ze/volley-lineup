import { Pressable, Text } from 'react-native';

import { borderWidth, makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

export interface TagChipProps {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  /** A suggestion (e.g. the server for an ace): yellow outline. */
  highlighted?: boolean;
  onPress: () => void;
  testID?: string;
}

/** A compact pill (≥ 44 px tall) in the point-tag row. */
export function TagChip({
  label,
  accessibilityLabel,
  selected = false,
  highlighted = false,
  onPress,
  testID,
}: TagChipProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      // react-native-web ignores accessibilityState.
      aria-pressed={selected}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        // After `selected`: the suggestion outline stays visible on a chosen chip.
        highlighted && styles.highlighted,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  chip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.round,
    // The room of the suggestion outline, so a chip doesn't change size when it lights up.
    borderWidth: borderWidth.thick,
    borderColor: theme.colors.transparent,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlighted: { borderColor: theme.colors.highlightText },
  // v11: a chosen tag is soft orange (solid orange is "Point us").
  selected: { backgroundColor: theme.colors.primarySoft },
  pressed: { opacity: 0.8 },
  label: { ...typography.body, fontWeight: '600', color: theme.colors.text },
  selectedLabel: { color: theme.colors.primaryText },
}));
