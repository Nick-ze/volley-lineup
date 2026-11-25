import { useRouter } from 'expo-router';
import { useState } from 'react';

import { codeInput, CODE_LENGTH, isPlausibleEmail } from '@/domain/syncSetup';
import type { SyncErrorCode } from '@/domain/types';
import { linkAccountToProfile, requestCode, signOut, verifyCode } from '@/lib/sync';
import { useAppStore } from '@/store';

import { useResendTimer } from './useResendTimer';

/** The form's message: a sync error, or the email check before sending. */
export type SignInError = SyncErrorCode | 'emailInvalid';

export interface SwitchedFrom {
  email: string;
  pending: number;
}

/**
 * v10: the sign-in form (docs/V10_SYNC_DESIGN.md §3.9): email → code → verify. A different
 * account than the one this device last synced asks first (`switchedFrom`); Cancel signs out.
 * Then the account is linked to the current profile and the cloud-teams setup opens.
 */
export function useSignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCodeText] = useState('');
  const [error, setError] = useState<SignInError | null>(null);
  const [busy, setBusy] = useState(false);
  const [switchedFrom, setSwitchedFrom] = useState<SwitchedFrom | null>(null);
  const resend = useResendTimer();

  const send = async () => {
    if (!isPlausibleEmail(email)) {
      setError('emailInvalid');
      return;
    }
    setBusy(true);
    const result = await requestCode(email.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setCodeText('');
    setStep('code');
    resend.start();
  };

  const finish = () => {
    const profileId = useAppStore.getState().currentProfileId;
    if (profileId) linkAccountToProfile(profileId);
    router.replace({ pathname: '/account/teams', params: { setup: '1' } });
  };

  const verify = async () => {
    if (code.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    const result = await verifyCode(email.trim(), code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (result.value.switchedFrom) setSwitchedFrom(result.value.switchedFrom);
    else finish();
  };

  const confirmSwitch = () => {
    setSwitchedFrom(null);
    finish();
  };

  const cancelSwitch = () => {
    setSwitchedFrom(null);
    setCodeText('');
    setStep('email');
    void signOut();
  };

  const changeEmail = () => {
    setError(null);
    setCodeText('');
    setStep('email');
  };

  return {
    step,
    email,
    setEmail: (text: string) => setEmail(text),
    code,
    setCode: (text: string) => setCodeText(codeInput(text)),
    error,
    busy,
    resendIn: resend.left,
    send,
    verify,
    changeEmail,
    switchedFrom,
    confirmSwitch,
    cancelSwitch,
  };
}
