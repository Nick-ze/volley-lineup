import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

import { NoTabSwipe } from './SwipeTabs';

export interface TextFieldProps extends Pick<
  TextInputProps,
  | 'keyboardType'
  | 'placeholder'
  | 'autoFocus'
  | 'onSubmitEditing'
  | 'maxLength'
  | 'inputMode'
  // v10: the sign-in form (email and one-time code autofill).
  | 'autoComplete'
  | 'textContentType'
  | 'autoCapitalize'
  | 'autoCorrect'
  // v10: the invite code field (no spelling marks under codes).
  | 'spellCheck'
> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Already-translated error message. */
  error?: string;
  testID?: string;
}

/** Height of a text field (px). */
const FIELD_HEIGHT = touchTarget + spacing.xs;
/** Width of the outline of a focused field. */
const FOCUS_RING = 1.5;

/** Labelled text input with an inline error message. */
export function TextField({ label, value, onChangeText, error, testID, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {/* v8: selecting text by dragging never swipes the tab. */}
      <NoTabSwipe>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, focused && styles.inputFocused, error ? styles.inputError : null]}
          testID={testID}
          {...rest}
        />
      </NoTabSwipe>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: theme.colors.textMuted },
  input: {
    ...typography.body,
    minHeight: FIELD_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    // v11: a filled field; the outline shows only while typing in it or on an error.
    borderWidth: FOCUS_RING,
    borderColor: theme.colors.transparent,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
  },
  inputFocused: { borderColor: theme.colors.primaryText },
  inputError: { borderColor: theme.colors.error },
  error: { ...typography.label, color: theme.colors.error },
}));
