import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

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
  const { colors } = useTheme();
  const styles = useStyles();
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
