import { act, fireEvent, screen } from '@testing-library/react-native';

import { parseImport } from '@/domain/exportSchema';
import { teamsWithDuplicateNumbers } from '@/domain/roster';
import type { SyncedTeam } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { saveTextFile } from '@/lib/fileTransfer';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { makePlayer, PROFILE_ID, renderApp, seedApp } from '@/test-utils';

jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

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

  it('says why one team failed, with the shared text for a limit (audit M16)', async () => {
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'team1', result: 'failed', error: 'tooMany' }],
    });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('upload-team1'));
    await fireEvent.press(screen.getByTestId('upload-selected'));
    expect(
      await screen.findByText(s.upload.failedBecause('Herren 1', t.sync.errors.tooMany)),
    ).toBeTruthy();
    expect(t.sync.errors.tooMany).toMatch(/10 teams per account/);
  });

  it('says why an upload failed', async () => {
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('upload-team1'));
    await fireEvent.press(screen.getByTestId('upload-selected'));
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
  });

  it('names a cloud team whose name hasn’t synced yet (audit L22)', async () => {
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'c9', name: '', role: 'manager', onDevice: false }],
    });
    await renderApp('/account/teams');
    expect(await screen.findByText(s.download.unnamed)).toBeTruthy();
  });

  it('downloads the ticked cloud teams', async () => {
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-c2'));
    expect(box('download-c2')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('download-selected'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c1'], []);
    expect(await screen.findByText(s.download.done(1))).toBeTruthy();
    expect(sync.listCloudTeams).toHaveBeenCalledTimes(2);
  });

  it('shows the offline message with Try again, and empty lists', async () => {
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    useAppStore.setState((st) => ({ sync: { ...st.sync, teams: { t2: linked, team1: linked } } }));
    await renderApp('/account/teams');
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
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

describe('downloading a team this device has an older copy of (audit M7)', () => {
  const copy = t.sync.localCopy;
  /** The device still has an old, unlinked copy of the cloud team `id`. */
  const withCopyOf = (id: string, name: string) =>
    useAppStore.setState((st) => ({
      teams: [...st.teams, { id, profileId: PROFILE_ID, name, createdAt: '' }],
    }));

  it('asks first; "Not now" keeps the copy and downloads only the other ticked teams', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    // The copy is offered for download only, never for upload.
    expect(await screen.findByTestId('download-c1')).toBeTruthy();
    expect(screen.queryByTestId('upload-c1')).toBeNull();
    await fireEvent.press(screen.getByTestId('download-selected'));
    expect(screen.getByTestId('local-copy-dialog')).toBeTruthy();
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body(['U18'], []));
    expect(sync.downloadTeams).not.toHaveBeenCalled();
    // The command leaves a copy it isn't told to replace (it answers with its id).
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: true, value: ['c1'] });
    await fireEvent.press(screen.getByTestId('local-copy-cancel'));
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    expect(sync.downloadTeams).toHaveBeenCalledTimes(1);
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c1', 'c2'], []);
    expect(await screen.findByText(s.download.done(1))).toBeTruthy();
    expect(useAppStore.getState().teams.find((x) => x.id === 'c1')?.name).toBe('U18 (old)');
  });

  it('"Not now" with only copies ticked downloads nothing', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-c2')); // untick the other team
    await fireEvent.press(screen.getByTestId('download-selected'));
    await fireEvent.press(screen.getByTestId('local-copy-cancel'));
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    expect(sync.downloadTeams).not.toHaveBeenCalled();
  });

  it('"Use the cloud version" downloads everything ticked and names the copy', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c1', 'c2'], ['c1']);
    expect(await screen.findByText(s.download.done(2))).toBeTruthy();
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
  });

  it('offers a backup first: the export runs and the question stays open', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    await fireEvent.press(screen.getByTestId('local-copy-export'));
    expect(saveTextFile).toHaveBeenCalledTimes(1);
    const [fileName, text] = jest.mocked(saveTextFile).mock.calls[0];
    expect(fileName).toMatch(/\.json$/);
    expect(JSON.parse(text).teams.map((x: { id: string }) => x.id)).toContain('c1');
    expect(await screen.findByTestId('local-copy-export-status')).toHaveTextContent(
      t.transfer.export.done(fileName),
    );
    expect(screen.getByTestId('local-copy-dialog')).toBeTruthy();
    expect(sync.downloadTeams).not.toHaveBeenCalled();
  });

  it('a manager’s copy: the question says what happens to it', async () => {
    withCopyOf('c2', 'Mixed (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-c1')); // untick the other team
    await fireEvent.press(screen.getByTestId('download-selected'));
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body([], ['Mixed']));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c2'], ['c2']);
  });

  it('copies of a view-only team and of a managed team: the question says what happens to each', async () => {
    withCopyOf('c1', 'U18 (old)');
    withCopyOf('c2', 'Mixed (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body(['U18'], ['Mixed']));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c1', 'c2'], ['c1', 'c2']);
  });

  // Found by the review: the backup the question offers must not be one the import refuses
  // without a word (two players with one jersey number, audit H6).
  it('warns, as Settings → Export does, when the backup couldn’t be imported again', async () => {
    withCopyOf('c1', 'U18 (old)');
    useAppStore.setState({
      players: [makePlayer(7, 'Sina', ['S']), makePlayer(7, 'Twin', ['OH'], { id: 'twin7' })],
    });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    const st = useAppStore.getState();
    expect(screen.getByTestId('local-copy-export-warning')).toHaveTextContent(
      t.transfer.export.duplicateNumbers(teamsWithDuplicateNumbers(st.teams, st.players)),
    );
    expect(screen.getByText(copy.exportHint)).toBeTruthy();
    // The file can still be exported; the import would refuse it, which the warning says.
    await fireEvent.press(screen.getByTestId('local-copy-export'));
    const [, text] = jest.mocked(saveTextFile).mock.calls[0];
    expect(parseImport(text)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('says what the backup is, and has no warning when the file is fine', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    expect(screen.getByText(copy.exportHint)).toBeTruthy();
    expect(screen.queryByTestId('local-copy-export-warning')).toBeNull();
    expect(copy.exportHint).toMatch(/Player descriptions are only in it if/);
    expect(de.sync.localCopy.exportHint).toMatch(/Beschreibungen mitexportieren/);
  });

  it('while the download runs nothing can be chosen and the question can’t be closed', async () => {
    withCopyOf('c1', 'U18 (old)');
    let finish: (value: { ok: true; value: string[] }) => void = () => undefined;
    jest
      .mocked(sync.downloadTeams)
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    for (const id of ['local-copy-replace', 'local-copy-export', 'local-copy-cancel']) {
      expect(screen.getByTestId(id)).toBeDisabled();
    }
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    await fireEvent.press(screen.getByTestId('local-copy-cancel'));
    // Nor by the back button / Escape.
    await fireEvent(screen.getByTestId('local-copy-dialog'), 'requestClose');
    expect(screen.getByTestId('local-copy-dialog')).toBeTruthy();
    expect(sync.downloadTeams).toHaveBeenCalledTimes(1);
    expect(saveTextFile).not.toHaveBeenCalled();
    await act(async () => finish({ ok: true, value: [] }));
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
  });

  it('a copy that isn’t ticked isn’t asked about', async () => {
    withCopyOf('c1', 'U18 (old)');
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-c1'));
    await fireEvent.press(screen.getByTestId('download-selected'));
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    expect(sync.downloadTeams).toHaveBeenCalledWith(['c2'], []);
  });

  it('counts only what was downloaded when the command left a copy alone', async () => {
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: true, value: ['c1'] });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('download-selected'));
    expect(await screen.findByText(s.download.done(1))).toBeTruthy();
  });

  it('sharing such a copy from the upload list says it is in the cloud, and offers it below', async () => {
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'team1', result: 'inCloud' }],
    });
    await renderApp('/account/teams');
    await fireEvent.press(await screen.findByTestId('upload-team1'));
    // The cloud list as it is by now: the team is one of the account's.
    jest.mocked(sync.listCloudTeams).mockResolvedValue({
      ok: true,
      value: [{ teamId: 'team1', name: 'Herren 1', role: 'manager', onDevice: false }],
    });
    await fireEvent.press(screen.getByTestId('upload-selected'));
    expect(
      await screen.findByText(s.upload.result('Herren 1', s.upload.results.inCloud)),
    ).toBeTruthy();
    // "Download the team below": the lists were loaded again, so it is there now.
    expect(await screen.findByTestId('download-team1')).toBeTruthy();
    expect(screen.queryByTestId('upload-team1')).toBeNull();
  });

  it('words the question for one and several teams, in German too', () => {
    expect(copy.body(['U18'], [])).toBe(
      'This device has an older copy of U18. The team’s cloud version takes its place, so changes made to the copy on this device are lost. Export a backup first?',
    );
    expect(copy.body([], ['U18', 'Mixed'])).toMatch(
      /^This device has older copies of U18, Mixed\. .*What only the copy has is added to the team\. Export a backup first\?$/,
    );
    expect(copy.body(['U18'], ['Mixed'])).toBe(
      'This device has older copies of U18, Mixed. Changes made to the copies on this device are lost: the cloud version takes the place of U18, and wins wherever both have something for Mixed (what only that copy has is added to the team). Export a backup first?',
    );
    expect(de.sync.localCopy.body(['U18'], [])).toMatch(/ältere Kopie von U18.*Sicherung/);
    expect(de.sync.localCopy.body([], ['U18', 'Mixed'])).toMatch(/ältere Kopien von U18, Mixed/);
    expect(de.sync.localCopy.body(['U18'], ['Mixed'])).toMatch(/Bei U18 .* bei Mixed /);
    expect(de.account.cloudTeams.upload.results.inCloud).toMatch(/ältere Kopie/);
  });
});
