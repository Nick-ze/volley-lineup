import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

export interface TextFieldProps extends Pick<
  TextInputProps,
  'keyboardType' | 'placeholder' | 'autoFocus' | 'onSubmitEditing' | 'maxLength' | 'inputMode'
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
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
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
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textMuted },
  input: {
    ...typography.body,
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputError: { borderColor: colors.error },
  error: { ...typography.label, color: colors.error },
});
