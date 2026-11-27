import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { en as t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

const signIn = () =>
  useSyncRuntime.setState({ session: { userId: 'me', email: 'anna@example.test' } });
const codeField = () => screen.getByLabelText(t.members.join.code);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(sync.listCloudTeams).mockResolvedValue({ ok: true, value: [] });
  seedApp();
});

describe('join a team', () => {
  it('fills in the code from the link and joins a team that is on the device', async () => {
    signIn();
    // The team is already shared on this device (an unshared copy is asked about: see below).
    useAppStore.setState((st) => ({
      sync: {
        ...st.sync,
        teams: {
          team1: { userId: 'me', role: 'player', cursor: 0, base: {}, edits: {}, photos: [] },
        },
      },
    }));
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'team1', role: 'player', name: null, localCopy: false },
    });
    await renderApp('/join?code=abcdefghjk');
    expect(codeField().props.value).toBe('ABCDE-FGHJK');
    await fireEvent.press(screen.getByLabelText(t.members.join.submitLabel));
    expect(sync.joinTeam).toHaveBeenCalledWith('ABCDEFGHJK');
    expect(await screen.findByText(t.members.join.joined('Herren 1', 'player'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.members.join.openLabel('Herren 1')));
    expect(screen).toHavePathname('/team/team1');
  });

  it('names a team that is still downloading and opens the team list', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'cloud9', role: 'manager', name: null, localCopy: false },
    });
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'cloud9', name: 'Damen 2', role: 'manager', onDevice: false }],
    });
    await renderApp('/join');
    await fireEvent.changeText(codeField(), 'volleylineup://join?code=YZ234-56789');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(sync.joinTeam).toHaveBeenCalledWith('YZ23456789');
    expect(await screen.findByText(t.members.join.joined('Damen 2', 'manager'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t.members.join.open));
    expect(screen).toHavePathname('/teams');
  });

  it('uses the name the join result gives (no cloud list needed)', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'cloud9', role: 'player', name: 'Mixed 3', localCopy: false },
    });
    await renderApp('/join?code=YZ23456789');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.members.join.joined('Mixed 3', 'player'))).toBeTruthy();
    expect(sync.listCloudTeams).not.toHaveBeenCalled();
  });

  it('without the name (cloud list unavailable) it still confirms', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'cloud9', role: 'player', name: null, localCopy: false },
    });
    jest.mocked(sync.listCloudTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp('/join?code=YZ23456789');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.members.join.joinedUnnamed('player'))).toBeTruthy();
  });

  it('an invalid or expired code says so', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({ ok: false, error: 'inviteInvalid' });
    await renderApp('/join?code=ABCDE-FGHJK');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.sync.errors.inviteInvalid)).toBeTruthy();
    // Typing again clears the message.
    await fireEvent.changeText(codeField(), 'ABCDE-FGHJ');
    expect(screen.queryByText(t.sync.errors.inviteInvalid)).toBeNull();
  });

  it('the code field is set up for codes (no autocorrect, caps, spelling) and takes links', async () => {
    signIn();
    await renderApp('/join');
    const field = codeField();
    expect(field.props).toMatchObject({
      autoCapitalize: 'characters',
      autoCorrect: false,
      autoComplete: 'off',
      spellCheck: false,
    });
    expect(field.props.maxLength).toBeUndefined();
  });

  it('reads the code again when a new link opens the screen', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({ ok: false, error: 'inviteInvalid' });
    await renderApp('/join?code=ABCDEFGHJK');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.sync.errors.inviteInvalid)).toBeTruthy();
    await act(async () => router.setParams({ code: 'yz234-56789' }));
    expect(codeField().props.value).toBe('YZ234-56789');
    expect(screen.queryByText(t.sync.errors.inviteInvalid)).toBeNull();
  });

  it('the server saying "not signed in" offers "Sign in first"', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({ ok: false, error: 'notSignedIn' });
    await renderApp('/join?code=ABCDEFGHJK');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.sync.errors.notSignedIn)).toBeTruthy();
    expect(screen.queryByTestId('join-submit')).toBeNull();
    await fireEvent.press(screen.getByLabelText(t.members.local.signInLabel));
    expect(screen).toHavePathname('/account/sign-in');
  });

  it('a code in the wrong format is not sent', async () => {
    signIn();
    await renderApp('/join?code=nonsense');
    expect(codeField().props.value).toBe('nonsense');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(screen.getByText(t.members.join.badFormat)).toBeTruthy();
    expect(sync.joinTeam).not.toHaveBeenCalled();
  });

  it('offline: says it needs a connection', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp('/join?code=ABCDEFGHJK');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
  });

  it('signed out: "Sign in first" instead of Join', async () => {
    await renderApp('/join?code=ABCDEFGHJK');
    expect(screen.getByText(t.members.join.signInNeeded)).toBeTruthy();
    expect(screen.queryByTestId('join-submit')).toBeNull();
    await fireEvent.press(screen.getByText(t.members.local.signIn));
    expect(screen).toHavePathname('/account/sign-in');
  });

  it('without a profile it goes to the profile picker', async () => {
    useAppStore.setState({ currentProfileId: null });
    await renderApp('/join?code=ABCDEFGHJK');
    expect(screen).toHavePathname('/');
  });
});

describe('joining a team this device has an older copy of (audit M7)', () => {
  const copy = t.sync.localCopy;
  /** The join worked; `team1` (Herren 1) is on the device as an older, unlinked copy. */
  async function joinedOverACopy(role: 'player' | 'manager' = 'player') {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'team1', role, name: 'Herren 1', localCopy: true },
    });
    await renderApp('/join?code=abcdefghjk');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByTestId('local-copy-dialog')).toBeTruthy();
  }

  it('asks before anything is downloaded, and doesn’t offer to open the old copy', async () => {
    await joinedOverACopy();
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body(['Herren 1'], false));
    expect(sync.downloadTeams).not.toHaveBeenCalled();
    expect(screen.queryByTestId('join-open')).toBeNull();
    expect(screen.queryByTestId('join-success')).toBeNull();
  });

  it('"Use the cloud version" downloads the team and then confirms the join', async () => {
    await joinedOverACopy('manager');
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body(['Herren 1'], true));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(sync.downloadTeams).toHaveBeenCalledWith(['team1'], ['team1']);
    expect(await screen.findByTestId('join-success')).toHaveTextContent(
      t.members.join.joined('Herren 1', 'manager'),
    );
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    await fireEvent.press(screen.getByTestId('join-open'));
    expect(screen).toHavePathname('/team/team1');
  });

  it('"Not now" keeps the copy, says so, and leads to Cloud teams', async () => {
    await joinedOverACopy();
    await fireEvent.press(screen.getByTestId('local-copy-cancel'));
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    expect(sync.downloadTeams).not.toHaveBeenCalled();
    expect(screen.getByTestId('join-copy-kept')).toHaveTextContent(copy.later('Herren 1'));
    expect(screen.queryByTestId('join-open')).toBeNull();
    await fireEvent.press(screen.getByTestId('join-cloud-teams'));
    expect(screen).toHavePathname('/account/teams');
  });

  it('a download that fails says why and the question stays', async () => {
    await joinedOverACopy();
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
    expect(screen.getByTestId('local-copy-dialog')).toBeTruthy();
    expect(screen.queryByTestId('join-success')).toBeNull();
    // A second try works.
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('join-success')).toBeTruthy();
  });
});
