import { useState } from 'react';
import { TextInput } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

/** Height of a score field (px). */
const FIELD_HEIGHT = touchTarget + spacing.sm;
/** Width of the outline of a focused field (as `TextField`). */
const FOCUS_RING = 1.5;
/** A set score has at most two digits (0–99). */
const MAX_DIGITS = 2;

export interface ScoreFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** e.g. "Set 1, TV Nord". */
  accessibilityLabel: string;
  error?: boolean;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * One score of a set: a filled field for two digits, with the numeric keyboard; the text is
 * selected on focus, so typing replaces it. The digits are large and equal-width.
 */
export function ScoreField({
  value,
  onChangeText,
  accessibilityLabel,
  error = false,
  autoFocus,
  testID,
}: ScoreFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, MAX_DIGITS))}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={MAX_DIGITS}
      selectTextOnFocus
      autoFocus={autoFocus}
      placeholder={PLACEHOLDER}
      placeholderTextColor={colors.textMuted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.input, focused && styles.focused, error && styles.error]}
      testID={testID}
    />
  );
}

/** Shown in an empty score field (a dash, not a text). */
const PLACEHOLDER = '–';

const useStyles = makeStyles((theme) => ({
  input: {
    ...typography.heading,
    flex: 1,
    minWidth: 0,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: FOCUS_RING,
    borderColor: theme.colors.transparent,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  focused: { borderColor: theme.colors.primaryText },
  error: { borderColor: theme.colors.error },
}));
