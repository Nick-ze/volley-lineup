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
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body(['Herren 1'], []));
    expect(sync.downloadTeams).not.toHaveBeenCalled();
    expect(screen.queryByTestId('join-open')).toBeNull();
    expect(screen.queryByTestId('join-success')).toBeNull();
  });

  /** What the real download does first: the team is linked on this device. */
  const linkTeam1 = () =>
    useAppStore.setState((st) => ({
      sync: {
        ...st.sync,
        teams: {
          team1: { userId: 'me', role: 'player', cursor: 0, base: {}, edits: {}, photos: [] },
        },
      },
    }));
  const downloadLinks = () =>
    jest.mocked(sync.downloadTeams).mockImplementationOnce(async () => {
      linkTeam1();
      return { ok: true as const, value: [] };
    });

  it('"Use the cloud version" downloads the team and then confirms the join', async () => {
    await joinedOverACopy('manager');
    expect(screen.getByTestId('local-copy-body')).toHaveTextContent(copy.body([], ['Herren 1']));
    downloadLinks();
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

  it('a download that fails says why inside the question, which stays', async () => {
    await joinedOverACopy();
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('local-copy-error')).toHaveTextContent(t.sync.errors.offline);
    expect(screen.getByTestId('local-copy-dialog')).toBeTruthy();
    expect(screen.queryByTestId('join-success')).toBeNull();
    // "Not now" after that: the copy is kept, and the old reason is gone.
    await fireEvent.press(screen.getByTestId('local-copy-cancel'));
    expect(screen.getByTestId('join-copy-kept')).toBeTruthy();
    expect(screen.queryByText(t.sync.errors.offline)).toBeNull();
  });

  it('a second try after a failed download works', async () => {
    await joinedOverACopy();
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('local-copy-error')).toBeTruthy();
    downloadLinks();
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('join-success')).toBeTruthy();
    expect(screen.queryByTestId('local-copy-error')).toBeNull();
  });

  // Found by the review: the download links the team before its first pull. When that pull
  // fails the team is linked all the same, and the copy gives way with the next sync — "Not
  // now" must not promise that it stays.
  it('a download that failed after the team was linked: no more question, the join is confirmed', async () => {
    await joinedOverACopy();
    jest.mocked(sync.downloadTeams).mockImplementationOnce(async () => {
      linkTeam1();
      return { ok: false as const, error: 'offline' as const };
    });
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('join-success')).toBeTruthy();
    expect(screen.queryByTestId('local-copy-dialog')).toBeNull();
    expect(screen.queryByTestId('join-copy-kept')).toBeNull();
  });

  // Found by the review: a membership that ended meanwhile makes the download answer "nothing
  // to do"; the screen must not say "joined" then.
  it('a download that linked nothing (no longer a member) says so and doesn’t confirm', async () => {
    await joinedOverACopy();
    jest.mocked(sync.downloadTeams).mockResolvedValueOnce({ ok: true, value: [] });
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(await screen.findByTestId('local-copy-error')).toHaveTextContent(
      t.sync.errors.forbidden,
    );
    expect(screen.queryByTestId('join-success')).toBeNull();
    expect(screen.queryByTestId('join-open')).toBeNull();
  });

  it('a second tap while the download runs sends nothing more', async () => {
    await joinedOverACopy();
    let finish: (value: { ok: true; value: string[] }) => void = () => undefined;
    jest
      .mocked(sync.downloadTeams)
      .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    await fireEvent.press(screen.getByTestId('local-copy-replace'));
    expect(sync.downloadTeams).toHaveBeenCalledTimes(1);
    linkTeam1();
    await act(async () => finish({ ok: true, value: [] }));
    expect(await screen.findByTestId('join-success')).toBeTruthy();
  });

  it('names the copy as this device knows it, not as the cloud calls the team', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'team1', role: 'player', name: 'Herren 1 (cloud name)', localCopy: true },
    });
    await renderApp('/join?code=abcdefghjk');
    await fireEvent.press(screen.getByTestId('join-submit'));
    expect(await screen.findByTestId('local-copy-body')).toHaveTextContent(
      copy.body(['Herren 1'], []),
    );
  });
});
