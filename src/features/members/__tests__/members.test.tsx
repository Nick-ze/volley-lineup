import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { TeamRole } from '@/domain/types';
import { en as t } from '@/i18n/en';
import * as share from '@/lib/share';
import * as sync from '@/lib/sync';
import { useAppStore, useSyncRuntime } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

jest.mock('@/lib/share', () => ({
  canShareText: jest.fn(() => true),
  shareText: jest.fn(async () => 'shared'),
  webAppBase: jest.fn(() => undefined),
}));

const URL = '/team/team1/members';

function signIn() {
  useSyncRuntime.setState({ session: { userId: 'me', email: 'coach@example.test' } });
}

function linkTeam(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'me', email: 'coach@example.test', profileId: 'prof1' },
      teams: { team1: { userId: 'me', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

const member = (userId: string, displayName: string, role: TeamRole, isMe = false) => ({
  userId,
  displayName,
  role,
  joinedAt: '2026-11-01T10:00:00.000Z',
  isMe,
});

const MEMBERS = [
  member('u3', 'Zoe', 'player'),
  member('me', 'Coach', 'manager', true),
  member('u2', 'Bob', 'player'),
];

const invite = (id: string, code: string, expiresAt: string, role: TeamRole = 'player') => ({
  id,
  code,
  role,
  expiresAt,
  revokedAt: null,
  uses: 2,
  maxUses: null as number | null,
});

const INVITES = [
  invite('inv-1', 'ABCDEFGHJK', '2099-12-03T12:00:00.000Z'),
  invite('inv-old', 'ZZZZZZZZZZ', '2020-01-01T00:00:00.000Z'),
  // A manager code works once: after the invited manager joined it is no longer listed.
  {
    ...invite('inv-used', 'YYYYYYYYYY', '2099-12-03T12:00:00.000Z', 'manager'),
    uses: 1,
    maxUses: 1,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(sync.listMembers).mockResolvedValue({ ok: true, value: [] });
  jest.mocked(sync.listInvites).mockResolvedValue({ ok: true, value: [] });
  jest.mocked(sync.isSyncConfigured).mockReturnValue(true);
  jest.mocked(share.canShareText).mockReturnValue(true);
  seedApp();
});

async function renderManager() {
  signIn();
  linkTeam('manager');
  jest.mocked(sync.listMembers).mockResolvedValue({ ok: true, value: MEMBERS });
  jest.mocked(sync.listInvites).mockResolvedValue({ ok: true, value: INVITES });
  await renderApp(URL);
  await screen.findByText('Bob');
}

describe('members: local team', () => {
  it('signed out: explains sharing and offers "Sign in first"', async () => {
    await renderApp(URL);
    expect(screen.getByText(t.members.local.intro)).toBeTruthy();
    expect(screen.queryByTestId('members-share-team')).toBeNull();
    await fireEvent.press(screen.getByLabelText(t.members.local.signInLabel));
    expect(screen).toHavePathname('/account/sign-in');
    expect(sync.uploadTeams).not.toHaveBeenCalled();
  });

  it('signed in: "Share this team" uploads it and then shows its members', async () => {
    signIn();
    jest.mocked(sync.listMembers).mockResolvedValue({
      ok: true,
      value: [member('me', 'Coach', 'manager', true)],
    });
    jest.mocked(sync.uploadTeams).mockImplementationOnce(async () => {
      linkTeam('manager'); // what the sync engine does on 'created'
      return { ok: true, value: [{ teamId: 'team1', result: 'created' as const }] };
    });
    await renderApp(URL);
    await fireEvent.press(screen.getByLabelText(t.members.local.shareLabel('Herren 1')));
    expect(sync.uploadTeams).toHaveBeenCalledWith(['team1']);
    expect(await screen.findByText(`Coach ${t.members.list.you}`)).toBeTruthy();
    expect(screen.getByTestId('invite-section')).toBeTruthy();
  });

  it('a new team id ("rekeyed") goes back to the team list', async () => {
    signIn();
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'team1', result: 'rekeyed' }],
    });
    await renderApp(URL);
    await fireEvent.press(screen.getByTestId('members-share-team'));
    await waitFor(() => expect(screen).toHavePathname('/teams'));
  });

  it('a new team id ("rekeyed" with newTeamId) opens the members screen under the new id', async () => {
    signIn();
    jest.mocked(sync.uploadTeams).mockImplementationOnce(async () => {
      useAppStore.setState((s) => ({
        teams: s.teams.map((x) => (x.id === 'team1' ? { ...x, id: 'team-new' } : x)),
        players: s.players.map((p) => (p.teamId === 'team1' ? { ...p, teamId: 'team-new' } : p)),
      }));
      return {
        ok: true,
        value: [{ teamId: 'team1', result: 'rekeyed' as const, newTeamId: 'team-new' }],
      };
    });
    await renderApp(URL);
    await fireEvent.press(screen.getByTestId('members-share-team'));
    await waitFor(() => expect(screen).toHavePathname('/team/team-new/members'));
  });

  it('sharing failed after the team got a new id: its screen under the new id says why', async () => {
    signIn();
    jest.mocked(sync.uploadTeams).mockImplementationOnce(async () => {
      useAppStore.setState((s) => ({
        teams: s.teams.map((x) => (x.id === 'team1' ? { ...x, id: 'team-new' } : x)),
        players: s.players.map((p) => (p.teamId === 'team1' ? { ...p, teamId: 'team-new' } : p)),
      }));
      return {
        ok: true,
        value: [
          {
            teamId: 'team1',
            result: 'failed' as const,
            newTeamId: 'team-new',
            error: 'tooMany' as const,
          },
        ],
      };
    });
    await renderApp(URL);
    await fireEvent.press(screen.getByTestId('members-share-team'));
    await waitFor(() => expect(screen).toHavePathname('/team/team-new/members'));
    expect(await screen.findByText(t.sync.errors.tooMany)).toBeTruthy();
    expect(screen.getByTestId('members-share-team')).toBeTruthy();
  });

  it.each(['__proto__', 'constructor', 'toString', 'nonsense'])(
    'ignores a `shareError` that isn’t an error code (%s, audit L19)',
    async (value) => {
      signIn();
      await renderApp(`${URL}?shareError=${value}`);
      expect(screen.getByTestId('members-share-team')).toBeTruthy();
      expect(screen.queryByText(t.sync.errors.unknown)).toBeNull();
    },
  );

  it('shows why sharing failed', async () => {
    signIn();
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({ ok: false, error: 'offline' });
    await renderApp(URL);
    await fireEvent.press(screen.getByTestId('members-share-team'));
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();

    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'team1', result: 'failed' }],
    });
    await fireEvent.press(screen.getByTestId('members-share-team'));
    expect(await screen.findByText(t.sync.errors.unknown)).toBeTruthy();
  });
});

describe('members: sharing an older copy of a team that is already in the cloud (audit M7)', () => {
  it('changes nothing, says so and leads to Cloud teams', async () => {
    signIn();
    jest.mocked(sync.uploadTeams).mockResolvedValueOnce({
      ok: true,
      value: [{ teamId: 'team1', result: 'inCloud' }],
    });
    await renderApp(URL);
    await fireEvent.press(screen.getByTestId('members-share-team'));
    expect(await screen.findByTestId('members-share-in-cloud')).toHaveTextContent(
      t.sync.localCopy.inCloud,
    );
    // Still a local team: the share button is there, nothing was linked.
    expect(screen.getByTestId('members-share-team')).toBeTruthy();
    expect(useAppStore.getState().sync.teams).toEqual({});
    await fireEvent.press(screen.getByTestId('members-open-cloud-teams'));
    expect(screen).toHavePathname('/account/teams');
  });
});

describe('members: manager', () => {
  it('lists managers first with "(you)", and only the active invites', async () => {
    await renderManager();
    const names = screen.getAllByText(/^(Coach|Bob|Zoe)/).map((n) => n.props.children);
    expect(names).toEqual([`Coach ${t.members.list.you}`, 'Bob', 'Zoe']);
    expect(screen.getByText('ABCDE-FGHJK')).toBeTruthy();
    expect(screen.getByText(t.members.invites.details('Player', '03.12.99', 2))).toBeTruthy();
    expect(screen.queryByText('ZZZZZ-ZZZZZ')).toBeNull();
    expect(screen.queryByText('YYYYY-YYYYY')).toBeNull();
    // No controls on the manager's own row.
    expect(screen.queryByTestId('member-role-me')).toBeNull();
    expect(sync.listInvites).toHaveBeenCalledWith('team1');
  });

  it('changes a role and reloads the list', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.list.makeManagerLabel('Bob')));
    expect(sync.setMemberRole).toHaveBeenCalledWith('team1', 'u2', 'manager');
    await waitFor(() => expect(sync.listMembers).toHaveBeenCalledTimes(2));
  });

  it('removes a member after confirming', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.list.removeLabel('Zoe')));
    expect(screen.getByText(t.members.list.removeConfirm('Zoe'))).toBeTruthy();
    expect(sync.removeMember).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.removeMember).toHaveBeenCalledWith('team1', 'u3');
  });

  it('creates an invite for a player, valid 30 days', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.newInviteLabel));
    expect(screen.getByTestId('new-invite-role-player')).toBeChecked();
    expect(screen.getByTestId('new-invite-days-7')).toBeChecked();
    await fireEvent.press(screen.getByText(t.members.newInviteDialog.dayOption(30)));
    expect(screen.getByTestId('new-invite-days-30')).toBeChecked();
    await fireEvent.press(screen.getByLabelText(t.members.newInviteDialog.createLabel));
    expect(sync.createInvite).toHaveBeenCalledWith('team1', 'player', 30);
    await waitFor(() => expect(sync.listInvites).toHaveBeenCalledTimes(2));
  });

  // Audit H5: the server refuses manager codes longer than 7 days. (This test used to pick
  // "Manager · 30 days" and expect that call — an invite that always failed on the server.)
  it('a manager invite offers 1 or 7 days only; a chosen 30 falls back to 7', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.newInviteLabel));
    await fireEvent.press(screen.getByText(t.members.newInviteDialog.dayOption(30)));
    await fireEvent.press(screen.getByTestId('new-invite-role-manager'));
    expect(screen.getByTestId('new-invite-role-manager')).toBeChecked();
    expect(screen.getByText(t.members.newInviteDialog.roleHint.manager)).toBeTruthy();
    expect(screen.queryByTestId('new-invite-days-30')).toBeNull();
    expect(screen.getByTestId('new-invite-days-7')).toBeChecked();
    await fireEvent.press(screen.getByTestId('new-invite-days-1'));
    // Back to player: 30 days is offered again, the choice stays.
    await fireEvent.press(screen.getByTestId('new-invite-role-player'));
    expect(screen.getByTestId('new-invite-days-30')).toBeTruthy();
    expect(screen.getByTestId('new-invite-days-1')).toBeChecked();
    await fireEvent.press(screen.getByTestId('new-invite-role-manager'));
    await fireEvent.press(screen.getByTestId('new-invite-days-7'));
    await fireEvent.press(screen.getByLabelText(t.members.newInviteDialog.createLabel));
    expect(sync.createInvite).toHaveBeenCalledWith('team1', 'manager', 7);
  });

  it('cancels a new invite without creating it', async () => {
    await renderManager();
    await fireEvent.press(screen.getByTestId('members-new-invite'));
    await fireEvent.press(screen.getByText(t.common.cancel));
    expect(screen.queryByTestId('new-invite-dialog')).toBeNull();
    expect(sync.createInvite).not.toHaveBeenCalled();
  });

  it('shares an invite with the code and the join link', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.invites.shareLabel('ABCDE-FGHJK')));
    expect(share.shareText).toHaveBeenCalledWith(
      t.members.invites.shareMessage(
        'Herren 1',
        'ABCDE-FGHJK',
        'volleylineup://join?code=ABCDEFGHJK',
      ),
      t.members.invites.shareTitle('Herren 1'),
    );
    expect(screen.queryByTestId('invite-share-result')).toBeNull();
  });

  it('copies an invite where there is no share sheet', async () => {
    jest.mocked(share.canShareText).mockReturnValue(false);
    jest.mocked(share.shareText).mockResolvedValueOnce('copied');
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.invites.copyLabel('ABCDE-FGHJK')));
    expect(await screen.findByText(t.members.invites.copied)).toBeTruthy();

    jest.mocked(share.shareText).mockResolvedValueOnce('failed');
    await fireEvent.press(screen.getByText(t.members.invites.copy));
    expect(await screen.findByText(t.members.invites.shareFailed)).toBeTruthy();
  });

  it('clears "Copied." on the next action', async () => {
    jest.mocked(share.shareText).mockResolvedValueOnce('copied');
    await renderManager();
    await fireEvent.press(screen.getByTestId('invite-share-inv-1'));
    expect(await screen.findByText(t.members.invites.copied)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('member-role-u2'));
    await waitFor(() => expect(screen.queryByText(t.members.invites.copied)).toBeNull());

    jest.mocked(share.shareText).mockResolvedValueOnce('copied');
    await fireEvent.press(screen.getByTestId('invite-share-inv-1'));
    expect(await screen.findByText(t.members.invites.copied)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('members-new-invite'));
    expect(screen.queryByText(t.members.invites.copied)).toBeNull();
  });

  it('revokes an invite after confirming', async () => {
    await renderManager();
    await fireEvent.press(screen.getByLabelText(t.members.invites.revokeLabel('ABCDE-FGHJK')));
    expect(screen.getByText(t.members.invites.revokeConfirm('ABCDE-FGHJK'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.revokeInvite).toHaveBeenCalledWith('inv-1');
  });

  it('says so when there are no active invites', async () => {
    signIn();
    linkTeam('manager');
    jest.mocked(sync.listMembers).mockResolvedValue({ ok: true, value: MEMBERS });
    jest.mocked(sync.listInvites).mockResolvedValue({ ok: true, value: [] });
    await renderApp(URL);
    expect(await screen.findByText(t.members.invites.none)).toBeTruthy();
  });

  it('the last manager is told to make someone else manager before leaving', async () => {
    await renderManager();
    jest.mocked(sync.leaveTeam).mockResolvedValueOnce({ ok: false, error: 'lastManager' });
    await fireEvent.press(screen.getByLabelText(t.members.leave.label('Herren 1')));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(sync.leaveTeam).toHaveBeenCalledWith('team1');
    expect(await screen.findByText(t.sync.errors.lastManager)).toBeTruthy();
    expect(screen).toHavePathname(URL);
  });

  it('the only member is told to delete the team instead', async () => {
    await renderManager();
    jest.mocked(sync.leaveTeam).mockResolvedValueOnce({ ok: false, error: 'lastMember' });
    await fireEvent.press(screen.getByTestId('members-leave'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(await screen.findByText(t.sync.errors.lastMember)).toBeTruthy();
  });

  it('shows a failed action (e.g. a forbidden role change)', async () => {
    await renderManager();
    jest.mocked(sync.setMemberRole).mockResolvedValueOnce({ ok: false, error: 'forbidden' });
    await fireEvent.press(screen.getByTestId('member-role-u2'));
    expect(await screen.findByText(t.sync.errors.forbidden)).toBeTruthy();
  });
});

describe('members: player', () => {
  beforeEach(() => {
    signIn();
    linkTeam('player');
    jest.mocked(sync.listMembers).mockResolvedValue({
      ok: true,
      value: [member('boss', 'Coach', 'manager'), member('me', 'Anna', 'player', true)],
    });
  });

  it('sees the members read-only and no invites', async () => {
    await renderApp(URL);
    expect(await screen.findByText(`Anna ${t.members.list.you}`)).toBeTruthy();
    expect(screen.getByText('Coach')).toBeTruthy();
    expect(screen.queryByTestId('invite-section')).toBeNull();
    expect(screen.queryByTestId('members-new-invite')).toBeNull();
    expect(screen.queryByTestId('member-role-boss')).toBeNull();
    expect(screen.queryByTestId('member-remove-boss')).toBeNull();
    expect(sync.listInvites).not.toHaveBeenCalled();
  });

  it('leaves the team and goes to the team list', async () => {
    await renderApp(URL);
    await screen.findByText('Coach');
    await fireEvent.press(screen.getByLabelText(t.members.leave.label('Herren 1')));
    expect(screen.getByText(t.members.leave.confirm('Herren 1'))).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.members.leave.confirmButton));
    expect(sync.leaveTeam).toHaveBeenCalledWith('team1');
    await waitFor(() => expect(screen).toHavePathname('/teams'));
  });
});

describe('members: leaving removes the team from the device', () => {
  it('ends on the team list without crashing when the engine drops the team first', async () => {
    await renderManager();
    jest.mocked(sync.leaveTeam).mockImplementationOnce(async () => {
      // What the sync engine does on success: unlink and remove the team locally.
      useAppStore.setState((s) => ({
        teams: s.teams.filter((team) => team.id !== 'team1'),
        sync: { ...s.sync, teams: {} },
      }));
      return { ok: true, value: undefined };
    });
    await fireEvent.press(screen.getByTestId('members-leave'));
    await fireEvent.press(screen.getByTestId('confirm'));
    await waitFor(() => expect(screen).toHavePathname('/teams'));
    expect(sync.leaveTeam).toHaveBeenCalledWith('team1');
    expect(screen.queryByText(t.roster.teamNotFound)).toBeNull();
  });
});

describe('members: loading', () => {
  beforeEach(() => linkTeam('manager'));

  it('offline: says so and loads again on "Try again"', async () => {
    signIn();
    jest.mocked(sync.listMembers).mockResolvedValueOnce({ ok: false, error: 'offline' });
    jest.mocked(sync.listMembers).mockResolvedValueOnce({ ok: true, value: MEMBERS });
    jest.mocked(sync.listInvites).mockResolvedValue({ ok: true, value: [] });
    await renderApp(URL);
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.members.list.retryLabel));
    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(screen.queryByText(t.sync.errors.offline)).toBeNull();
  });

  it('a manager whose invites fail to load still sees the members', async () => {
    signIn();
    jest.mocked(sync.listMembers).mockResolvedValue({ ok: true, value: MEMBERS });
    jest.mocked(sync.listInvites).mockResolvedValueOnce({ ok: false, error: 'unknown' });
    await renderApp(URL);
    expect(await screen.findByText(t.sync.errors.unknown)).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByTestId('invite-section')).toBeNull();
  });

  it('signed out: "Sign in first" instead of "Try again"', async () => {
    jest.mocked(sync.listMembers).mockResolvedValueOnce({ ok: false, error: 'notSignedIn' });
    await renderApp(URL);
    expect(await screen.findByText(t.sync.errors.notSignedIn)).toBeTruthy();
    expect(screen.queryByTestId('members-retry')).toBeNull();
    expect(screen.getByTestId('members-sign-in')).toBeTruthy();
  });

  it('the first screen after a reload: loading while the session is restored, then the list (v10 QA)', async () => {
    linkTeam('manager');
    // Like the real command: without a session, listing fails with notSignedIn.
    jest
      .mocked(sync.listMembers)
      .mockImplementation(async () =>
        useSyncRuntime.getState().session
          ? { ok: true, value: MEMBERS }
          : { ok: false, error: 'notSignedIn' },
      );
    useSyncRuntime.setState({ restoring: true });
    await renderApp(URL);
    expect(await screen.findByText(t.members.list.loading)).toBeTruthy();
    expect(screen.queryByTestId('members-sign-in')).toBeNull();
    expect(screen.queryByText(t.sync.errors.notSignedIn)).toBeNull();

    await act(async () =>
      useSyncRuntime.setState({
        restoring: false,
        session: { userId: 'me', email: 'coach@example.test' },
      }),
    );
    expect(await screen.findByText('Bob')).toBeTruthy();
    expect(screen.queryByText(t.members.list.loading)).toBeNull();
    expect(screen.queryByTestId('members-sign-in')).toBeNull();
  });

  it('restoring while offline: the offline note with Try again, not "Sign in first"', async () => {
    linkTeam('manager');
    jest.mocked(sync.listMembers).mockResolvedValue({ ok: false, error: 'notSignedIn' });
    useSyncRuntime.setState((r) => ({
      restoring: true,
      status: { ...r.status, phase: 'offline' },
    }));
    await renderApp(URL);
    expect(await screen.findByText(t.sync.errors.offline)).toBeTruthy();
    expect(screen.getByTestId('members-retry')).toBeEnabled();
    expect(screen.queryByText(t.members.list.loading)).toBeNull();
    expect(screen.queryByTestId('members-sign-in')).toBeNull();
    // Try again also asks the engine to sync (it restores the session once online).
    await fireEvent.press(screen.getByTestId('members-retry'));
    expect(sync.syncNow).toHaveBeenCalledTimes(1);
  });

  it('a Try again that answers after the lists’ key changed is dropped (never stuck loading)', async () => {
    signIn();
    let answer: (r: { ok: false; error: 'offline' }) => void = () => undefined;
    jest
      .mocked(sync.listMembers)
      .mockResolvedValueOnce({ ok: false, error: 'offline' })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      )
      .mockResolvedValue({ ok: true, value: MEMBERS });
    await renderApp(URL);
    await fireEvent.press(await screen.findByTestId('members-retry'));
    // While that reload is out, the cached role changes (a sync): the lists load again.
    await act(async () => linkTeam('player'));
    expect(await screen.findByText('Bob')).toBeTruthy();
    // The old reload answers last: it belongs to the old key and is dropped.
    await act(async () => answer({ ok: false, error: 'offline' }));
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.queryByText(t.members.list.loading)).toBeNull();
    expect(screen.queryByText(t.sync.errors.offline)).toBeNull();
    expect(screen.getByTestId('members-leave')).toBeEnabled();
  });

  it('an unknown team shows "not found"', async () => {
    await renderApp('/team/nope/members');
    expect(screen.getByText(t.roster.teamNotFound)).toBeTruthy();
  });
});

describe('team header button', () => {
  it('"Share" on a local team opens the members screen', async () => {
    await renderApp('/team/team1');
    await fireEvent.press(screen.getByLabelText(t.members.header.shareLabel('Herren 1')));
    expect(screen).toHavePathname(URL);
  });

  it('"Members" on a shared team', async () => {
    linkTeam('player');
    await renderApp('/team/team1');
    expect(screen.getByText(t.members.header.members)).toBeTruthy();
    expect(screen.getByLabelText(t.members.header.membersLabel('Herren 1'))).toBeTruthy();
  });

  it('is hidden without a backend', async () => {
    jest.mocked(sync.isSyncConfigured).mockReturnValue(false);
    await renderApp('/team/team1');
    expect(screen.queryByTestId('team-members-button')).toBeNull();
  });

  it('switches from "Share" to "Members" when the team gets shared', async () => {
    await renderApp('/team/team1');
    expect(screen.getByText(t.members.header.share)).toBeTruthy();
    await act(async () => linkTeam('manager'));
    expect(screen.getByText(t.members.header.members)).toBeTruthy();
  });
});
