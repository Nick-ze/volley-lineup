import { fireEvent, screen } from '@testing-library/react-native';

import type { SyncNotice, SyncPhase, TeamRole } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import * as sync from '@/lib/sync';
import { initialSyncStatus, useAppStore, useSyncRuntime } from '@/store';
import { renderApp, seedApp } from '@/test-utils';

// Expo Router warns about modal routes rendered as the first screen; not what this tests.
beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const ACCOUNT = { userId: 'u1', email: 'coach@example.test', profileId: 'prof1' };

function link(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: ACCOUNT,
      teams: { team1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

function status(phase: SyncPhase, pending = 0) {
  useSyncRuntime.setState({ status: { ...initialSyncStatus(), phase, pending } });
}

beforeEach(() => seedApp());

describe('sync badge (Teams tab)', () => {
  it('is hidden while sync is off and no account is linked (local-only app)', async () => {
    await renderApp('/teams');
    expect(screen.getByText(t.roster.teams.heading('Coach'))).toBeTruthy();
    expect(screen.queryByTestId('sync-badge')).toBeNull();
  });

  it.each<[SyncPhase, number, string]>([
    ['synced', 0, t.sync.status.synced],
    ['syncing', 0, t.sync.status.syncing],
    ['offline', 0, t.sync.status.offline],
    ['offline', 3, 'Offline (3)'],
    ['error', 0, t.sync.status.error],
    ['off', 0, t.sync.status.off],
  ])('shows %s (%i pending) as “%s”', async (phase, pending, text) => {
    useAppStore.setState({ sync: { deviceId: 'dev1', account: ACCOUNT, teams: {} } });
    status(phase, pending);
    await renderApp('/teams');
    expect(screen.getByTestId('sync-badge')).toHaveTextContent(text, { exact: false });
    expect(screen.getByRole('button', { name: t.sync.badge.label(text) })).toBeTruthy();
  });

  it('signed in without shared teams: “No shared teams”, not “Not signed in” (v10 QA)', async () => {
    useAppStore.setState({ sync: { deviceId: 'dev1', account: ACCOUNT, teams: {} } });
    useSyncRuntime.setState({ session: { userId: 'u1', email: ACCOUNT.email } });
    status('off');
    await renderApp('/teams');
    const text = t.sync.status.noTeams;
    expect(text).toBe('No shared teams');
    expect(screen.getByTestId('sync-badge')).toHaveTextContent(text, { exact: false });
    expect(screen.getByRole('button', { name: t.sync.badge.label(text) })).toBeTruthy();
    expect(screen.queryByText(t.sync.status.off)).toBeNull();
  });

  it('while the stored session is restored: not “Not signed in” either', async () => {
    link('manager');
    useSyncRuntime.setState({ restoring: true });
    status('off');
    await renderApp('/teams');
    // A shared team: the first cycle runs right after the session is back.
    expect(screen.getByTestId('sync-badge')).toHaveTextContent(t.sync.status.syncing, {
      exact: false,
    });
  });

  it('shows the state without an account too, and opens the account screen', async () => {
    status('synced');
    await renderApp('/teams');
    await fireEvent.press(screen.getByTestId('sync-badge'));
    expect(screen).toHavePathname('/account');
  });
});

describe('sync notices', () => {
  const notices: SyncNotice[] = [
    { kind: 'removed', teamId: 'a', teamName: 'Alpha' },
    { kind: 'deleted', teamId: 'b', teamName: 'Beta' },
    { kind: 'demoted', teamId: 'c', teamName: 'Gamma', undone: 2 },
    { kind: 'skipped', teamId: 'd', teamName: 'Delta', count: 1 },
  ];

  it('the “no longer a member” notice also covers a team deleted for everyone (audit L24)', () => {
    // The server can't tell the two apart; both reach the device as `removed`.
    expect(t.sync.notices.removed('Alpha')).toBe(
      'You’re no longer a member of Alpha: you were removed or the team was deleted. It stays on this device as a local copy.',
    );
    expect(de.sync.notices.removed('Alpha')).toMatch(/entfernt oder das Team wurde gelöscht/);
  });

  it('shows each notice and removes it on Dismiss', async () => {
    useSyncRuntime.setState({ notices });
    await renderApp('/teams');
    expect(screen.getByText(t.sync.notices.removed('Alpha'))).toBeTruthy();
    expect(screen.getByText(t.sync.notices.deleted('Beta'))).toBeTruthy();
    expect(
      screen.getByText('You can now only view Gamma; 2 unsynced changes were undone.'),
    ).toBeTruthy();
    expect(screen.getByText(t.sync.notices.skipped('Delta', 1))).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: t.sync.notices.dismissLabel('Beta') }),
    );
    expect(screen.queryByText(t.sync.notices.deleted('Beta'))).toBeNull();
    expect(useSyncRuntime.getState().notices.map((n) => n.teamName)).toEqual([
      'Alpha',
      'Gamma',
      'Delta',
    ]);
  });

  it('shows nothing without notices', async () => {
    await renderApp('/teams');
    expect(screen.queryByTestId('sync-notices')).toBeNull();
  });

  it('tells the previous scorer that another device took over (audit M1)', async () => {
    const taken: SyncNotice = {
      kind: 'takenOver',
      teamId: 'e',
      teamName: 'Echo',
      holder: 'Anna',
      undone: 2,
    };
    useSyncRuntime.setState({ notices: [taken] });
    await renderApp('/teams');
    expect(
      screen.getByText(
        'Anna took over scoring a match of Echo. 2 changes made here that hadn’t synced yet were undone.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: t.sync.notices.dismissLabel('Echo') })).toBeTruthy();
    expect(t.sync.notices.takenOver('Echo', '', 1)).toBe(
      'Someone else took over scoring a match of Echo. 1 change made here that hadn’t synced yet was undone.',
    );
    expect(de.sync.notices.takenOver('Echo', 'Anna', 1)).toBe(
      'Anna hat bei einem Spiel von Echo das Zählen übernommen. 1 Änderung von diesem Gerät, die noch nicht synchronisiert war, wurde zurückgenommen.',
    );
    expect(de.sync.notices.takenOver('Echo', '', 3)).toBe(
      'Jemand anderes hat bei einem Spiel von Echo das Zählen übernommen. 3 Änderungen von diesem Gerät, die noch nicht synchronisiert waren, wurden zurückgenommen.',
    );
  });

  it('words the demotion without undone changes and several skipped records', () => {
    expect(t.sync.notices.demoted('Gamma', 0)).toBe('You can now only view Gamma.');
    expect(t.sync.notices.demoted('Gamma', 1)).toContain('1 unsynced change was undone');
    expect(t.sync.notices.skipped('Delta', 4)).toContain('4 records');
  });
});

describe('Teams tab: Join a team and shared rows', () => {
  it('offers Join a team when sync is configured and opens /join', async () => {
    await renderApp('/teams');
    await fireEvent.press(screen.getByRole('button', { name: t.sync.team.joinLabel }));
    expect(screen).toHavePathname('/join');
  });

  it('has no Join a team without a sync backend', async () => {
    jest.mocked(sync.isSyncConfigured).mockReturnValue(false);
    try {
      await renderApp('/teams');
      expect(screen.getByRole('button', { name: t.roster.teams.new })).toBeTruthy();
      expect(screen.queryByTestId('join-team')).toBeNull();
    } finally {
      jest.mocked(sync.isSyncConfigured).mockReturnValue(true);
    }
  });

  it('a local team has no mark and keeps Edit', async () => {
    await renderApp('/teams');
    expect(screen.queryByTestId('team-team1-shared')).toBeNull();
    expect(screen.getByRole('button', { name: t.roster.teams.open('Herren 1') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.roster.teams.rename('Herren 1') })).toBeTruthy();
  });

  it('a manager’s shared team says “Shared” and keeps Edit', async () => {
    link('manager');
    await renderApp('/teams');
    expect(screen.getByTestId('team-team1-shared')).toHaveTextContent(t.sync.shared);
    expect(screen.getByRole('button', { name: t.roster.teams.rename('Herren 1') })).toBeTruthy();
  });

  it('a player’s shared team says “View only” and has no Edit (rename / picture)', async () => {
    link('player');
    await renderApp('/teams');
    expect(screen.getByTestId('team-team1-shared')).toHaveTextContent('Shared · View only');
    expect(
      screen.getByRole('button', {
        name: t.sync.team.rowLabel(t.roster.teams.open('Herren 1'), 'Shared · View only'),
      }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.roster.teams.rename('Herren 1') })).toBeNull();
    expect(screen.getByRole('button', { name: t.roster.teams.delete('Herren 1') })).toBeTruthy();
  });
});
