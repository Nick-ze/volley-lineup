import { fireEvent, screen } from '@testing-library/react-native';

import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { PROFILE_ID, renderApp, seedApp } from '@/test-utils';

const d = t.transfer.danger;

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
});

describe('Delete all data with an account (v10)', () => {
  it('says the user is signed out, signs out, then deletes; the device id stays', async () => {
    useAppStore.setState((st) => ({
      sync: {
        ...st.sync,
        deviceId: 'dev1',
        account: { userId: 'user-1', email: 'coach@example.com', profileId: PROFILE_ID },
      },
    }));
    useSyncRuntime.setState({ session: { userId: 'user-1', email: 'coach@example.com' } });
    await renderApp('/settings');
    await fireEvent.press(screen.getByLabelText(d.button));
    expect(screen.getByText(`${d.confirmBody} ${t.account.signOutNote}`)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(d.confirm));
    expect(await screen.findByText(d.done)).toBeTruthy();
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    const state = useAppStore.getState();
    expect(state.teams).toEqual([]);
    expect(state.sync).toEqual({ deviceId: 'dev1', account: null, teams: {} });
  });

  it('without an account: the text and behaviour of 9.2 (no sign-out)', async () => {
    await renderApp('/settings');
    await fireEvent.press(screen.getByLabelText(d.button));
    expect(screen.getByText(d.confirmBody)).toBeTruthy();
    expect(screen.queryByText(t.account.signOutNote, { exact: false })).toBeNull();
    await fireEvent.press(screen.getByLabelText(d.confirm));
    expect(screen.getByText(d.done)).toBeTruthy();
    expect(sync.signOut).not.toHaveBeenCalled();
  });
});
