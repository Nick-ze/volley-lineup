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
  /** Whether the code step was reached by sending an email now (not by "I already have a code"). */
  const [sent, setSent] = useState(false);
  const resend = useResendTimer();

  const send = async () => {
    // A second Enter / tap while a request is under way sends nothing.
    if (busy) return;
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
    setSent(true);
    setStep('code');
    resend.start();
  };

  /**
   * "I already have a code": the code step for this email without sending another email (the
   * code of the last email stays valid for a while). No resend wait: nothing was sent now.
   */
  const haveCode = () => {
    if (busy) return;
    if (!isPlausibleEmail(email)) {
      setError('emailInvalid');
      return;
    }
    setError(null);
    setCodeText('');
    setSent(false);
    setStep('code');
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
    sent,
    send,
    haveCode,
    verify,
    changeEmail,
    switchedFrom,
    confirmSwitch,
    cancelSwitch,
  };
}
