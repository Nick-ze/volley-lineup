import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { initialSyncStatus, useAppStore, useSyncRuntime } from '@/store';
import { PROFILE_ID, renderApp, seedApp } from '@/test-utils';

const s = t.account.profileSection;
const account = { userId: 'user-1', email: 'coach@example.com', profileId: PROFILE_ID };

function link(signedIn: boolean, pending = 0) {
  useAppStore.setState((st) => ({ sync: { ...st.sync, account } }));
  if (signedIn) {
    useSyncRuntime.setState({
      session: { userId: 'user-1', email: 'coach@example.com' },
      status: { ...initialSyncStatus(), phase: 'synced', pending },
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
});

describe('Profile tab → Cloud sync', () => {
  it('is hidden when the backend is not configured', async () => {
    jest.mocked(sync.isSyncConfigured).mockReturnValue(false);
    try {
      await renderApp('/profile');
      expect(screen.getByTestId('profile-screen')).toBeTruthy();
      expect(screen.queryByText(s.title)).toBeNull();
    } finally {
      jest.mocked(sync.isSyncConfigured).mockReturnValue(true);
    }
  });

  it('signed out: Sign in opens the sign-in screen', async () => {
    await renderApp('/profile');
    expect(screen.getByText(s.signedOut)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(s.signInLabel));
    expect(screen).toHavePathname('/account/sign-in');
  });

  it.each([
    ['/profile', 'profile-sign-in'],
    ['/account', 'account-sign-in'],
    ['/account/sign-in', 'sign-in-send'],
    ['/join', 'join-submit'],
  ])(
    '%s waits for the stored session on a cold start: no "Sign in" yet (audit M14)',
    async (path, signInTestId) => {
      jest.spyOn(console, 'warn').mockImplementation(() => {}); // modal route as first screen
      link(false);
      useSyncRuntime.setState({ session: null, restoring: true });
      await renderApp(path);
      expect(screen.getByText(s.restoring)).toBeTruthy();
      expect(screen.queryByTestId(signInTestId)).toBeNull();
      expect(screen.queryByLabelText(s.signInLabel)).toBeNull();
      expect(screen.queryByText(t.members.join.signInNeeded)).toBeNull();
      // The session arrives: signed in, as before.
      await act(async () =>
        useSyncRuntime.setState({
          session: { userId: 'user-1', email: 'coach@example.com' },
          restoring: false,
        }),
      );
      expect(screen.queryByText(s.restoring)).toBeNull();
      jest.mocked(console.warn).mockRestore();
    },
  );

  it('without a stored session it says "Sign in" once restoring ends', async () => {
    link(false);
    useSyncRuntime.setState({ session: null, restoring: true });
    await renderApp('/profile');
    await act(async () => useSyncRuntime.setState({ restoring: false }));
    expect(screen.getByLabelText(s.signInLabel)).toBeTruthy();
  });

  it('signed in: email, status and Account', async () => {
    link(true, 1);
    await renderApp('/profile');
    expect(screen.getByText(s.signedIn('coach@example.com'))).toBeTruthy();
    expect(screen.getByText(`${t.sync.status.synced} · ${t.sync.status.pending(1)}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(s.openLabel));
    expect(screen).toHavePathname('/account');
  });

  it('says when the account belongs to another profile (no sign-in here)', async () => {
    useAppStore.setState((st) => ({
      profiles: [...st.profiles, { id: 'p2', name: 'Assistant', color: '#3D8BFF', createdAt: '' }],
      sync: { ...st.sync, account: { ...account, profileId: 'p2' } },
    }));
    await renderApp('/profile');
    expect(screen.getByText(s.otherProfile('coach@example.com', 'Assistant'))).toBeTruthy();
    expect(screen.queryByLabelText(s.signInLabel)).toBeNull();
  });
});

describe('Log out and delete profile sign out', () => {
  it('Log out of the linked profile signs out', async () => {
    link(true);
    await renderApp('/profile');
    await fireEvent.press(screen.getByTestId('logout'));
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen).toHavePathname('/'));
    // The link stays, so signing in again resumes sync.
    expect(useAppStore.getState().sync.account).toEqual(account);
  });

  it('Log out asks first with unsynced changes', async () => {
    link(true, 2);
    await renderApp('/profile');
    await fireEvent.press(screen.getByTestId('logout'));
    expect(screen.getByText(t.account.screen.signOutConfirm(2))).toBeTruthy();
    expect(sync.signOut).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.signOut).toHaveBeenCalledTimes(1);
  });

  it('Log out of a profile without an account does not sign out', async () => {
    await renderApp('/profile');
    await fireEvent.press(screen.getByTestId('logout'));
    expect(sync.signOut).not.toHaveBeenCalled();
  });

  it('deleting the linked profile says so and signs out; the account link is cleared', async () => {
    link(true);
    await renderApp('/profile');
    await fireEvent.press(screen.getByLabelText(t.profile.deleteLabel('Coach')));
    expect(
      screen.getByText(`${t.roster.confirm.deleteProfile('Coach')} ${t.account.signOutNote}`),
    ).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm'));
    });
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().profiles).toEqual([]);
    expect(useAppStore.getState().sync.account).toBeNull();
  });

  it('signed out, deleting the linked profile adds no sentence but still signs out', async () => {
    link(false);
    await renderApp('/profile');
    await fireEvent.press(screen.getByLabelText(t.profile.deleteLabel('Coach')));
    expect(screen.getByText(t.roster.confirm.deleteProfile('Coach'))).toBeTruthy();
    expect(screen.queryByText(t.account.signOutNote, { exact: false })).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm'));
    });
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().sync.account).toBeNull();
  });
});
