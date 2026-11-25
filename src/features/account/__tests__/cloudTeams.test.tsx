import { fireEvent, screen } from '@testing-library/react-native';

import type { SyncedTeam } from '@/domain/types';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { PROFILE_ID, renderApp, seedApp } from '@/test-utils';

const s = t.account.cloudTeams;
const linked: SyncedTeam = {
  userId: 'user-1',
  role: 'manager',
  cursor: 0,
  base: {},
  edits: {},
  photos: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
  // team1 (Herren 1) is local; t2 (Damen 2) is already shared; t3 is another profile's.
  useAppStore.setState((st) => ({
    teams: [
      ...st.teams,
      { id: 't2', profileId: PROFILE_ID, name: 'Damen 2', createdAt: '' },
      { id: 't3', profileId: 'other', name: 'Not mine', createdAt: '' },
    ],
    sync: {
      ...st.sync,
      account: { userId: 'user-1', email: 'coach@example.com', profileId: PROFILE_ID },
      teams: { t2: linked },
    },
  }));
  useSyncRuntime.setState({ session: { userId: 'user-1', email: 'coach@example.com' } });
  jest.mocked(sync.listCloudTeams).mockResolvedValue({
    ok: true,
    value: [
      { teamId: 't2', name: 'Damen 2', role: 'manager', onDevice: true },
      { teamId: 'c1', name: 'U18', role: 'player', onDevice: false },
      { teamId: 'c2', name: 'Mixed', role: 'manager', onDevice: false },
    ],
  });
});

const box = (testID: string) => screen.getByTestId(testID);

describe('cloud teams setup', () => {
  it('offers unshared teams unchecked and cloud teams checked; nothing uploads without a tap', async () => {
    await renderApp('/account/teams?setup=1');
    expect(await screen.findByTestId('download-c1')).toBeTruthy();
    // Upload: only this profile's team that isn't shared yet, unchecked.
    expect(box('upload-team1')).not.toBeChecked();
    expect(screen.queryByTestId('upload-t2')).toBeNull();
    expect(screen.queryByTestId('upload-t3')).toBeNull();
    expect(screen.getByTestId('upload-selected')).toBeDisabled();
    // Download: the cloud teams not on this device, checked, with the role.
    expect(box('download-c1')).toBeChecked();
    expect(box('download-c2')).toBeChecked();
    expect(screen.queryByTestId('download-t2')).toBeNull();
    expect(screen.getByLabelText(`U18: ${t.account.screen.roles.player}`)).toBeTruthy();
    expect(sync.uploadTeams).not.toHaveBeenCalled();
    expect(sync.downloadTeams).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('cloud-teams-done'));
    expect(screen).toHavePathname('/account');
    expect(sync.uploadTeams).not.toHaveBeenCalled();
    expect(sync.downloadTeams).not.toHaveBeenCalled();
  });

  it('uploads the ticked teams and shows a result per team', async () => {
    useAppStore.setState((st) => ({
      teams: [...st.teams, { id: 't4', profileId: PROFILE_ID, name: 'Herren 2', createdAt: '' }],
    }));
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 't4', result: 'failed' }],
    });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('upload-t4'));
    expect(box('upload-t4')).toBeChecked();
    expect(box('upload-team1')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('upload-selected'));
    expect(sync.uploadTeams).toHaveBeenCalledWith(['t4']);
    expect(
      await screen.findByText(s.upload.result('Herren 2', s.upload.results.failed)),
    ).toBeTruthy();
  });

  it('says why an upload failed', async () => {
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('upload-team1'));
    await fireEvent.press(screen.getByTestId('upload-selected'));
    expect(await screen.findByText(t.account.errors.offline)).toBeTruthy();
  });

  it('downloads the ticked cloud teams', async () => {
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-c2'));
    expect(box('download-c2')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('download-selected'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c1']);
    expect(await screen.findByText(s.download.done(1))).toBeTruthy();
    expect(sync.listCloudTeams).toHaveBeenCalledTimes(2);
  });

  it('shows the offline message with Try again, and empty lists', async () => {
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    useAppStore.setState((st) => ({ sync: { ...st.sync, teams: { t2: linked, team1: linked } } }));
    await renderApp('/account/teams');
    expect(await screen.findByText(t.account.errors.offline)).toBeTruthy();
    expect(screen.getByText(s.upload.empty)).toBeTruthy();
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({ ok: true, value: [] });
    await fireEvent.press(screen.getByRole('button', { name: s.retry }));
    expect(await screen.findByText(s.download.empty)).toBeTruthy();
  });

  it('signed out: Sign in instead of the pickers', async () => {
    useSyncRuntime.setState({ session: null });
    await renderApp('/account/teams');
    expect(screen.getByText(t.account.profileSection.signedOut)).toBeTruthy();
    expect(screen.queryByTestId('upload-selected')).toBeNull();
    expect(sync.listCloudTeams).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('cloud-teams-sign-in'));
    expect(screen).toHavePathname('/account/sign-in');
  });
});
