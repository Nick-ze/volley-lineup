import { fireEvent, screen } from '@testing-library/react-native';

import { en as t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

// Expo Router warns about modal routes rendered as the first screen; not what this tests.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

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
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'team1', role: 'player' },
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
      value: { teamId: 'cloud9', role: 'manager' },
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

  it('without the name (cloud list unavailable) it still confirms', async () => {
    signIn();
    jest.mocked(sync.joinTeam).mockResolvedValueOnce({
      ok: true,
      value: { teamId: 'cloud9', role: 'player' },
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
    expect(await screen.findByText(t.members.errors.inviteInvalid)).toBeTruthy();
    // Typing again clears the message.
    await fireEvent.changeText(codeField(), 'ABCDE-FGHJ');
    expect(screen.queryByText(t.members.errors.inviteInvalid)).toBeNull();
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
    expect(await screen.findByText(t.members.errors.offline)).toBeTruthy();
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
