import { useRouter } from 'expo-router';
import { Text } from 'react-native';

import { Button, ConfirmDialog, Screen, TextField } from '@/components';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { makeStyles, typography } from '@/theme';

import { CodeStep } from './CodeStep';
import { ErrorText } from './ErrorText';
import { useAccountLink } from './useAccountLink';
import { useSignIn } from './useSignIn';

/**
 * v10: `/account/sign-in` (modal): email → "Send code" → the 6-digit code → "Sign in". Only from
 * a profile, and not while the device's account belongs to another profile (§6).
 */
export function SignInScreen() {
  const styles = useStyles();
  const t = useT();
  const s = t.account.signIn;
  const router = useRouter();
  useTourPage('signIn');
  const link = useAccountLink();
  const form = useSignIn();

  if (link.kind === 'noProfile' || link.kind === 'otherProfile') {
    return (
      <Screen testID="sign-in-screen">
        <Text style={styles.text}>
          {link.kind === 'noProfile'
            ? s.noProfile
            : t.account.profileSection.otherProfile(link.email, link.profileName)}
        </Text>
        {link.kind === 'noProfile' ? (
          <Button label={s.openProfiles} onPress={() => router.replace('/')} />
        ) : null}
      </Screen>
    );
  }

  const emailError = form.error === 'emailInvalid' ? s.emailInvalid : undefined;
  const syncError = form.error === 'emailInvalid' ? null : form.error;

  return (
    <Screen testID="sign-in-screen">
      {form.step === 'email' ? (
        <>
          <Text style={styles.text}>{s.intro}</Text>
          <TextField
            label={s.email}
            value={form.email}
            onChangeText={form.setEmail}
            error={emailError}
            keyboardType="email-address"
            inputMode="email"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={() => void form.send()}
            testID="sign-in-email"
          />
          <ErrorText error={syncError} testID="sign-in-error" />
          <Button
            label={s.sendCode}
            onPress={() => void form.send()}
            disabled={form.busy}
            testID="sign-in-send"
          />
          <Button
            label={s.haveCode}
            variant="ghost"
            onPress={form.haveCode}
            disabled={form.busy}
            testID="sign-in-have-code"
          />
        </>
      ) : (
        <CodeStep form={form} error={syncError} />
      )}
      <ConfirmDialog
        visible={form.switchedFrom !== null}
        message={
          form.switchedFrom
            ? s.switchConfirm(form.switchedFrom.email, form.switchedFrom.pending)
            : ''
        }
        confirmLabel={s.switchContinue}
        onConfirm={form.confirmSwitch}
        onCancel={form.cancelSwitch}
      />
    </Screen>
  );
}

const useStyles = makeStyles((theme) => ({
  text: { ...typography.body, color: theme.colors.text },
}));
