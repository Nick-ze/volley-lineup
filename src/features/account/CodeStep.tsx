import { Text, View } from 'react-native';

import { Button, TextField } from '@/components';
import { CODE_LENGTH } from '@/domain/syncSetup';
import type { SyncErrorCode } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { ErrorText } from './ErrorText';
import type { useSignIn } from './useSignIn';

/**
 * How much raw text the code field takes: more than the 6 digits, so a pasted "123 456" or
 * "123-456" isn't cut before `codeInput` keeps its digits (and caps them at 6).
 */
export const CODE_INPUT_MAX = 12;

export interface CodeStepProps {
  form: ReturnType<typeof useSignIn>;
  error: SyncErrorCode | null;
}

/** v10: the sign-in code field (one-time-code autofill, digits only) with resend and Change email. */
export function CodeStep({ form, error }: CodeStepProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.account.signIn;
  const waiting = form.resendIn > 0;
  return (
    <>
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {s.codeSent(form.email.trim())}
      </Text>
      <TextField
        label={s.code}
        value={form.code}
        onChangeText={form.setCode}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_INPUT_MAX}
        autoFocus
        onSubmitEditing={() => void form.verify()}
        testID="sign-in-code"
      />
      <ErrorText error={error} testID="sign-in-error" />
      <Button
        label={s.verify}
        onPress={() => void form.verify()}
        disabled={form.busy || form.code.length !== CODE_LENGTH}
        testID="sign-in-verify"
      />
      <View style={styles.row}>
        <Button
          label={waiting ? s.resendIn(form.resendIn) : s.resend}
          variant="secondary"
          onPress={() => void form.send()}
          disabled={waiting || form.busy}
          testID="sign-in-resend"
        />
        <Button
          label={s.changeEmail}
          variant="ghost"
          onPress={form.changeEmail}
          testID="sign-in-change-email"
        />
      </View>
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  text: { ...typography.body, color: theme.colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
