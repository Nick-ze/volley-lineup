import { act, fireEvent, screen } from '@testing-library/react-native';

import { formatSyncTime } from '@/domain/syncSetup';
import type { SyncedTeam } from '@/domain/types';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { initialSyncStatus, useAppStore, useSyncRuntime } from '@/store';
import { PROFILE_ID, renderApp, seedApp } from '@/test-utils';

const s = t.account.screen;
const d = t.account.deleteAccount;
const meta = (role: SyncedTeam['role']): SyncedTeam => ({
  userId: 'user-1',
  role,
  cursor: 0,
  base: {},
  edits: {},
  photos: [],
});

function signIn(pending = 0) {
  useAppStore.setState((st) => ({
    teams: [...st.teams, { id: 't2', profileId: PROFILE_ID, name: 'Damen 2', createdAt: '' }],
    sync: {
      ...st.sync,
      account: { userId: 'user-1', email: 'coach@example.com', profileId: PROFILE_ID },
      teams: { team1: meta('manager'), t2: meta('player') },
    },
  }));
  useSyncRuntime.setState({
    session: { userId: 'user-1', email: 'coach@example.com' },
    status: {
      ...initialSyncStatus(),
      phase: 'synced',
      pending,
      lastSyncedAt: '2026-11-25T08:05:00.000Z',
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
});

describe('account screen', () => {
  it('not signed in: a short note and Sign in', async () => {
    await renderApp('/account');
    expect(screen.getByText(s.signedOut)).toBeTruthy();
    expect(screen.queryByTestId('sync-now')).toBeNull();
    await fireEvent.press(screen.getByTestId('account-sign-in'));
    expect(screen).toHavePathname('/account/sign-in');
  });

  it('signed in: email, status, Sync now, shared teams with roles and the links', async () => {
    signIn(2);
    await renderApp('/account');
    expect(screen.getByText(t.account.profileSection.signedIn('coach@example.com'))).toBeTruthy();
    expect(screen.getByTestId('account-status')).toHaveTextContent(
      `${t.sync.status.synced} · ${t.sync.status.pending(2)}`,
    );
    expect(screen.getByText(s.lastSynced(formatSyncTime('2026-11-25T08:05:00.000Z')))).toBeTruthy();
    expect(screen.getByLabelText(s.openTeamLabel('Herren 1', s.roles.manager))).toBeTruthy();
    expect(screen.getByLabelText(s.openTeamLabel('Damen 2', s.roles.player))).toBeTruthy();

    await fireEvent.press(screen.getByTestId('sync-now'));
    expect(sync.syncNow).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('account-cloud-teams'));
    expect(screen).toHavePathname('/account/teams');
  });

  it('Join a team opens /join', async () => {
    signIn();
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('account-join'));
    expect(screen).toHavePathname('/join');
  });

  it('shows a sync error and "Not synced yet"', async () => {
    signIn();
    useSyncRuntime.setState({
      status: { ...initialSyncStatus(), phase: 'error', error: 'signedOut' },
    });
    await renderApp('/account');
    expect(screen.getByText(t.account.errors.signedOut)).toBeTruthy();
    expect(screen.getByText(s.notSynced)).toBeTruthy();
  });

  it('Sign out asks only with unsynced changes', async () => {
    signIn();
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(sync.signOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      useSyncRuntime.setState((st) => ({ status: { ...st.status, pending: 3 } }));
    });
    await fireEvent.press(screen.getByTestId('sign-out'));
    expect(screen.getByText(s.signOutConfirm(3))).toBeTruthy();
    expect(sync.signOut).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.signOut).toHaveBeenCalledTimes(2);
  });
});

describe('delete account', () => {
  it('lists blocked teams with a Members link and deletes nothing', async () => {
    signIn();
    jest.mocked(sync.accountDeletionCheck).mockResolvedValueOnce({
      ok: true,
      value: { deleteTeams: [], blockedTeams: ['team1', 'gone'] },
    });
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'gone', name: 'Cloud only', role: 'manager', onDevice: false }],
    });
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('delete-account'));
    const blocked = await screen.findByTestId('delete-account-blocked');
    expect(blocked).toHaveTextContent(new RegExp(d.blocked.slice(0, 30)));
    expect(blocked).toHaveTextContent(/Herren 1/);
    expect(blocked).toHaveTextContent(/Cloud only/);
    expect(sync.deleteAccount).not.toHaveBeenCalled();
    // Only the team on this device gets a Members link.
    expect(screen.queryByLabelText(d.membersLabel('Cloud only'))).toBeNull();
    await fireEvent.press(screen.getByLabelText(d.membersLabel('Herren 1')));
    expect(screen).toHavePathname('/team/team1/members');
  });

  it('confirms (naming sole-member teams), deletes and keeps local data', async () => {
    signIn();
    jest.mocked(sync.accountDeletionCheck).mockResolvedValueOnce({
      ok: true,
      value: { deleteTeams: ['t2'], blockedTeams: [] },
    });
    const before = useAppStore.getState().teams;
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(await screen.findByText(d.confirm(['Damen 2']))).toBeTruthy();
    expect(d.confirm(['Damen 2'])).toMatch(/deleted for good: Damen 2/);
    expect(sync.listCloudTeams).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.deleteAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(d.done)).toBeTruthy();
    expect(useAppStore.getState().teams).toBe(before);
  });

  it('Cancel deletes nothing; offline says so', async () => {
    signIn();
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.press(await screen.findByRole('button', { name: t.common.cancel }));
    expect(sync.deleteAccount).not.toHaveBeenCalled();

    jest.mocked(sync.accountDeletionCheck).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(await screen.findByText(t.account.errors.offline)).toBeTruthy();
    expect(sync.deleteAccount).not.toHaveBeenCalled();
  });

  it('a failed delete says why', async () => {
    signIn();
    jest.mocked(sync.deleteAccount).mockResolvedValueOnce({ ok: false, error: 'unknown' });
    await renderApp('/account');
    await fireEvent.press(screen.getByTestId('delete-account'));
    await fireEvent.press(await screen.findByTestId('confirm'));
    expect(await screen.findByText(t.account.errors.unknown)).toBeTruthy();
    expect(screen.queryByText(d.done)).toBeNull();
  });
});
