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

/** Labelled text input with an inline error message. */
export function TextField({ label, value, onChangeText, error, testID, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
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
          style={[styles.input, error ? styles.inputError : null]}
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
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  inputError: { borderColor: theme.colors.error },
  error: { ...typography.label, color: theme.colors.error },
}));
