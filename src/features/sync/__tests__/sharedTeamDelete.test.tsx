import { act, fireEvent, screen } from '@testing-library/react-native';

import type { SyncErrorCode, TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { useAppStore } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const s = t.sync.teamDelete;
const NAME = 'Herren 1';

function link(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'prof1' },
      teams: { team1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

const teamIds = () => useAppStore.getState().teams.map((x) => x.id);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

async function openDelete() {
  await renderApp('/teams');
  await press(t.roster.teams.delete(NAME));
  expect(await screen.findByTestId('shared-team-delete')).toBeTruthy();
}

const failWith = (fn: typeof sync.leaveTeam, error: SyncErrorCode) =>
  jest.mocked(fn).mockResolvedValueOnce({ ok: false, error });

beforeEach(() => {
  jest.clearAllMocks();
  seedApp();
});

describe('deleting a local team', () => {
  it('keeps the old confirm dialog', async () => {
    await renderApp('/teams');
    await press(t.roster.teams.delete(NAME));
    expect(screen.getByText(t.roster.confirm.deleteTeam(NAME))).toBeTruthy();
    expect(screen.queryByTestId('shared-team-delete')).toBeNull();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(teamIds()).toEqual([]);
    expect(sync.unlinkTeam).not.toHaveBeenCalled();
  });
});

describe('deleting a shared team as a manager', () => {
  beforeEach(() => link('manager'));

  it('offers this device / everyone; no Leave', async () => {
    await openDelete();
    expect(screen.getByText(s.managerBody)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.deleteEverywhereLabel(NAME) })).toBeTruthy();
    expect(screen.queryByRole('button', { name: s.leaveLabel(NAME) })).toBeNull();
  });

  it('Remove from this device unlinks first, then deletes locally (no server call)', async () => {
    // At unlink time the team must still be on the device (never a linked, empty team).
    let presentAtUnlink: boolean | null = null;
    jest
      .mocked(sync.unlinkTeam)
      .mockImplementationOnce((id) => (presentAtUnlink = teamIds().includes(id)));
    await openDelete();
    expect(screen.getByText(s.title(NAME))).toBeTruthy();
    await press(s.removeHereLabel(NAME));
    expect(presentAtUnlink).toBe(true);
    expect(teamIds()).toEqual([]);
    expect(sync.unlinkTeam).toHaveBeenCalledWith('team1');
    expect(sync.deleteTeamEverywhere).not.toHaveBeenCalled();
    expect(screen.queryByTestId('shared-team-delete')).toBeNull();
  });

  it('Delete for everyone deletes in the cloud, then unlinks and deletes here', async () => {
    let presentAtUnlink: boolean | null = null;
    jest
      .mocked(sync.unlinkTeam)
      .mockImplementationOnce((id) => (presentAtUnlink = teamIds().includes(id)));
    await openDelete();
    await press(s.deleteEverywhereLabel(NAME));
    expect(sync.deleteTeamEverywhere).toHaveBeenCalledWith('team1');
    expect(presentAtUnlink).toBe(true);
    expect(teamIds()).toEqual([]);
    expect(screen.queryByTestId('shared-team-delete')).toBeNull();
  });

  it('can’t be cancelled while the request runs', async () => {
    let answer: (r: { ok: true; value: undefined }) => void = () => undefined;
    jest
      .mocked(sync.deleteTeamEverywhere)
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await openDelete();
    await press(s.deleteEverywhereLabel(NAME));
    const cancel = screen.getByRole('button', { name: s.cancelLabel });
    expect(cancel).toBeDisabled();
    await fireEvent.press(cancel);
    expect(screen.getByTestId('shared-team-delete')).toBeTruthy();
    await act(async () => answer({ ok: true, value: undefined }));
    expect(screen.queryByTestId('shared-team-delete')).toBeNull();
    expect(teamIds()).toEqual([]);
  });

  it('Delete for everyone offline says it needs a connection and keeps the team', async () => {
    failWith(sync.deleteTeamEverywhere, 'offline');
    await openDelete();
    await press(s.deleteEverywhereLabel(NAME));
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
    expect(teamIds()).toEqual(['team1']);
    expect(sync.unlinkTeam).not.toHaveBeenCalled();
    // Cancel closes the dialog, the team stays.
    await press(s.cancelLabel);
    expect(screen.queryByTestId('shared-team-delete')).toBeNull();
    expect(teamIds()).toEqual(['team1']);
  });
});

describe('deleting a shared team as a player', () => {
  beforeEach(() => link('player'));

  it('offers this device / Leave team; no Delete for everyone', async () => {
    await openDelete();
    expect(screen.getByText(s.removeTitle(NAME))).toBeTruthy();
    expect(screen.getByText(s.playerBody)).toBeTruthy();
    expect(screen.queryByRole('button', { name: s.deleteEverywhereLabel(NAME) })).toBeNull();
  });

  it('Leave team leaves in the cloud, then unlinks and removes the team here', async () => {
    let presentAtUnlink: boolean | null = null;
    jest
      .mocked(sync.unlinkTeam)
      .mockImplementationOnce((id) => (presentAtUnlink = teamIds().includes(id)));
    await openDelete();
    await press(s.leaveLabel(NAME));
    expect(sync.leaveTeam).toHaveBeenCalledWith('team1');
    expect(sync.unlinkTeam).toHaveBeenCalledWith('team1');
    expect(presentAtUnlink).toBe(true);
    expect(teamIds()).toEqual([]);
  });

  it.each<[SyncErrorCode, string]>([
    ['lastManager', t.sync.errors.lastManager],
    ['lastMember', t.sync.errors.lastMember],
    ['forbidden', t.sync.errors.forbidden],
    ['signedOut', t.sync.errors.signedOut],
    ['notSignedIn', t.sync.errors.notSignedIn],
    ['unknown', t.sync.errors.unknown],
  ])('a failed leave (%s) shows its reason and keeps the team', async (error, text) => {
    failWith(sync.leaveTeam, error);
    await openDelete();
    await press(s.leaveLabel(NAME));
    expect(await screen.findByText(text)).toBeTruthy();
    expect(teamIds()).toEqual(['team1']);
  });

  it('Remove from this device keeps the membership (no server call)', async () => {
    await openDelete();
    await press(s.removeHereLabel(NAME));
    expect(sync.leaveTeam).not.toHaveBeenCalled();
    expect(sync.unlinkTeam).toHaveBeenCalledWith('team1');
    expect(teamIds()).toEqual([]);
  });
});
