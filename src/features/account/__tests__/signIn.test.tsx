import { act, fireEvent, renderHook, screen } from '@testing-library/react-native';

import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

import { CODE_INPUT_MAX } from '../CodeStep';
import { useResendTimer } from '../useResendTimer';

const s = t.account.signIn;

// Expo Router warns about a modal route rendered as the first screen; not what this tests.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
});

const typeEmail = (text: string) => fireEvent.changeText(screen.getByTestId('sign-in-email'), text);
const typeCode = (text: string) => fireEvent.changeText(screen.getByTestId('sign-in-code'), text);
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

async function toCodeStep() {
  await renderApp('/account/sign-in');
  await typeEmail(' coach@example.com ');
  await press('sign-in-send');
  expect(await screen.findByTestId('sign-in-code')).toBeTruthy();
}

describe('sign in with an email code', () => {
  it('checks the email, sends a code, rejects a wrong code, then signs in and opens setup', async () => {
    await renderApp('/account/sign-in');
    expect(screen.getByText(s.intro)).toBeTruthy();
    await typeEmail('coach');
    await press('sign-in-send');
    expect(screen.getByText(s.emailInvalid)).toBeTruthy();
    expect(sync.requestCode).not.toHaveBeenCalled();

    await typeEmail(' coach@example.com ');
    await press('sign-in-send');
    expect(sync.requestCode).toHaveBeenCalledWith('coach@example.com');
    expect(await screen.findByText(s.codeSent('coach@example.com'))).toBeTruthy();

    // Digits only, at most 6; Sign in is off until all 6 are there.
    await typeCode('12 3');
    expect(screen.getByTestId('sign-in-code').props.value).toBe('123');
    expect(screen.getByTestId('sign-in-verify')).toBeDisabled();
    await typeCode('12-34-56-78');
    expect(screen.getByTestId('sign-in-code').props.value).toBe('123456');
    const field = screen.getByTestId('sign-in-code');
    expect(field.props.textContentType).toBe('oneTimeCode');
    expect(field.props.autoComplete).toBe('one-time-code');
    expect(field.props.keyboardType).toBe('number-pad');
    // Longer than the code: a pasted "123 456" must not be cut before the digits are kept.
    expect(field.props.maxLength).toBe(CODE_INPUT_MAX);

    jest.mocked(sync.verifyCode).mockResolvedValueOnce({ ok: false, error: 'invalidCode' });
    await press('sign-in-verify');
    expect(await screen.findByText(t.sync.errors.invalidCode)).toBeTruthy();
    expect(sync.linkAccountToProfile).not.toHaveBeenCalled();

    await press('sign-in-verify');
    expect(sync.verifyCode).toHaveBeenLastCalledWith('coach@example.com', '123456');
    expect(sync.linkAccountToProfile).toHaveBeenCalledWith('prof1');
    expect(screen).toHavePathname('/account/teams');
    expect(screen).toHaveSearchParams({ setup: '1' });
  });

  it.each(['123 456', '123-456', ' 123 456 '])(
    'a pasted “%s” keeps all 6 digits (the field cuts at maxLength first, v10 QA)',
    async (pasted) => {
      await toCodeStep();
      const field = screen.getByTestId('sign-in-code');
      // What the platform hands onChangeText: the paste cut to maxLength.
      await typeCode(pasted.slice(0, field.props.maxLength));
      expect(screen.getByTestId('sign-in-code').props.value).toBe('123456');
      expect(screen.getByTestId('sign-in-verify')).toBeEnabled();
    },
  );

  it('says so when offline or rate-limited and stays on the step', async () => {
    jest.mocked(sync.requestCode).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp('/account/sign-in');
    await typeEmail('coach@example.com');
    await press('sign-in-send');
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
    expect(screen.queryByTestId('sign-in-code')).toBeNull();

    jest.mocked(sync.requestCode).mockResolvedValueOnce({ ok: false, error: 'rateLimited' });
    await press('sign-in-send');
    expect(await screen.findByText(t.sync.errors.rateLimited)).toBeTruthy();
  });

  it('has its own texts for a failed send and a refused address (audit M13)', async () => {
    jest.mocked(sync.requestCode).mockResolvedValueOnce({ ok: false, error: 'mailFailed' });
    await renderApp('/account/sign-in');
    await typeEmail('coach@example.com');
    await press('sign-in-send');
    expect(await screen.findByText(t.sync.errors.mailFailed)).toBeTruthy();
    expect(screen.queryByText(t.sync.errors.offline)).toBeNull();
    expect(screen.queryByTestId('sign-in-code')).toBeNull();

    jest.mocked(sync.requestCode).mockResolvedValueOnce({ ok: false, error: 'emailRejected' });
    await press('sign-in-send');
    expect(await screen.findByText(t.sync.errors.emailRejected)).toBeTruthy();
  });

  it('sends one request while one is under way (double Enter)', async () => {
    let resolve: (value: { ok: true; value: undefined }) => void = () => {};
    jest.mocked(sync.requestCode).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await renderApp('/account/sign-in');
    await typeEmail('coach@example.com');
    await fireEvent(screen.getByTestId('sign-in-email'), 'submitEditing');
    await fireEvent(screen.getByTestId('sign-in-email'), 'submitEditing');
    expect(sync.requestCode).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, value: undefined }));
    expect(await screen.findByTestId('sign-in-code')).toBeTruthy();
  });

  it('Change email goes back to the email step', async () => {
    await toCodeStep();
    await press('sign-in-change-email');
    expect(screen.getByTestId('sign-in-email')).toBeTruthy();
  });
});

describe('"I already have a code" (docs/AUDIT_V10.md M13: fewer sign-in emails)', () => {
  async function withCode(email = 'coach@example.com') {
    await renderApp('/account/sign-in');
    await typeEmail(email);
    await press('sign-in-have-code');
  }

  it('opens the code step without sending an email', async () => {
    await withCode(' coach@example.com ');
    expect(screen.getByTestId('sign-in-code')).toBeTruthy();
    expect(sync.requestCode).not.toHaveBeenCalled();
    // The text doesn't claim an email was sent just now.
    expect(screen.getByText(s.codeFromBefore('coach@example.com'))).toBeTruthy();
    expect(screen.queryByText(s.codeSent('coach@example.com'))).toBeNull();
  });

  it('signs in with the code of an earlier email', async () => {
    await withCode(' coach@example.com ');
    await typeCode('123456');
    await press('sign-in-verify');
    expect(sync.verifyCode).toHaveBeenCalledWith('coach@example.com', '123456');
    expect(sync.requestCode).not.toHaveBeenCalled();
  });

  it('needs a valid email first', async () => {
    await withCode('coach');
    expect(screen.getByText(s.emailInvalid)).toBeTruthy();
    expect(screen.queryByTestId('sign-in-code')).toBeNull();
  });

  it('lets a new code be requested at once (no resend wait: nothing was sent)', async () => {
    await withCode();
    const resend = screen.getByTestId('sign-in-resend');
    expect(resend.props.accessibilityState?.disabled).toBeFalsy();
    expect(screen.getByText(s.resend)).toBeTruthy();
    await press('sign-in-resend');
    expect(sync.requestCode).toHaveBeenCalledWith('coach@example.com');
    expect(await screen.findByText(s.codeSent('coach@example.com'))).toBeTruthy();
  });

  it('is named by its visible text', async () => {
    await renderApp('/account/sign-in');
    expect(screen.getByLabelText(s.haveCode)).toBeTruthy();
  });
});

describe('account switch', () => {
  const switched = {
    ok: true as const,
    value: { userId: 'user-2', switchedFrom: { email: 'old@example.com', pending: 2 } },
  };

  it('asks first; Cancel signs out and links nothing', async () => {
    await toCodeStep();
    await typeCode('123456');
    jest.mocked(sync.verifyCode).mockResolvedValueOnce(switched);
    await press('sign-in-verify');
    expect(await screen.findByText(s.switchConfirm('old@example.com', 2))).toBeTruthy();
    expect(s.switchConfirm('old@example.com', 2)).toMatch(/2 changes not synced yet/);
    await fireEvent.press(screen.getByRole('button', { name: t.common.cancel }));
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    expect(sync.linkAccountToProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-in-email')).toBeTruthy();
    expect(screen).toHavePathname('/account/sign-in');
  });

  it('Continue links the new account to this profile and opens setup', async () => {
    await toCodeStep();
    await typeCode('123456');
    jest.mocked(sync.verifyCode).mockResolvedValueOnce(switched);
    await press('sign-in-verify');
    await fireEvent.press(await screen.findByRole('button', { name: s.switchContinue }));
    expect(sync.signOut).not.toHaveBeenCalled();
    expect(sync.linkAccountToProfile).toHaveBeenCalledWith('prof1');
    expect(screen).toHavePathname('/account/teams');
  });

  it('the screen closing on the question signs out (audit M17)', async () => {
    await toCodeStep();
    await typeCode('123456');
    jest.mocked(sync.verifyCode).mockResolvedValueOnce(switched);
    await press('sign-in-verify');
    expect(await screen.findByText(s.switchConfirm('old@example.com', 2))).toBeTruthy();
    expect(sync.signOut).not.toHaveBeenCalled();
    await act(async () => screen.unmount());
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    expect(sync.linkAccountToProfile).not.toHaveBeenCalled();
  });

  it('the screen closing during the code check signs out once it answers (audit M17)', async () => {
    await toCodeStep();
    await typeCode('123456');
    let answer: (value: typeof switched) => void = () => {};
    jest
      .mocked(sync.verifyCode)
      .mockReturnValueOnce(new Promise<typeof switched>((resolve) => (answer = resolve)));
    await press('sign-in-verify');
    await act(async () => screen.unmount());
    expect(sync.signOut).not.toHaveBeenCalled();
    await act(async () => answer(switched));
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    expect(sync.linkAccountToProfile).not.toHaveBeenCalled();
  });

  it('closing after an answer signs nothing out', async () => {
    await toCodeStep();
    await typeCode('123456');
    jest.mocked(sync.verifyCode).mockResolvedValueOnce(switched);
    await press('sign-in-verify');
    await fireEvent.press(await screen.findByRole('button', { name: s.switchContinue }));
    await act(async () => screen.unmount());
    expect(sync.signOut).not.toHaveBeenCalled();
  });
});

describe('who may sign in here', () => {
  it('not while the account belongs to another profile', async () => {
    useAppStore.setState((st) => ({
      profiles: [...st.profiles, { id: 'p2', name: 'Assistant', color: '#3D8BFF', createdAt: '' }],
      sync: { ...st.sync, account: { userId: 'u1', email: 'a@example.com', profileId: 'p2' } },
    }));
    await renderApp('/account/sign-in');
    expect(screen.getByText(t.account.profileSection.otherProfile('a@example.com', 'Assistant')));
    expect(screen.queryByTestId('sign-in-email')).toBeNull();
  });

  it('not without a profile', async () => {
    useAppStore.setState({ currentProfileId: null });
    await renderApp('/account/sign-in');
    expect(screen.getByText(s.noProfile)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: s.openProfiles }));
    expect(screen).toHavePathname('/');
  });
});

describe('resend timer', () => {
  it('waits 60 s before another code can be sent', async () => {
    await toCodeStep();
    expect(screen.getByTestId('sign-in-resend')).toHaveTextContent(s.resendIn(60));
    expect(screen.getByTestId('sign-in-resend')).toBeDisabled();
  });

  it('counts down and allows a new code after 60 s', async () => {
    jest.useFakeTimers();
    try {
      const { result } = await renderHook(() => useResendTimer());
      expect(result.current.left).toBe(0);
      await act(async () => result.current.start());
      expect(result.current.left).toBe(60);
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(result.current.left).toBe(30);
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(result.current.left).toBe(0);
      await act(async () => {
        jest.advanceTimersByTime(5_000);
      });
      expect(result.current.left).toBe(0);
      await act(async () => result.current.start());
      expect(result.current.left).toBe(60);
    } finally {
      jest.useRealTimers();
    }
  });
});
