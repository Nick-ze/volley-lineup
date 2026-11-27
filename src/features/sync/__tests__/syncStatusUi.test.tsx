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
    expect(screen.getByTestId('teams-screen')).toBeTruthy();
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

  it('says that a shared team can’t be shown yet; Dismiss names "a shared team" (audit M6)', async () => {
    const waiting: SyncNotice = { kind: 'waiting', teamId: 'w', teamName: '' };
    useSyncRuntime.setState({ notices: [waiting] });
    await renderApp('/teams');
    expect(screen.getByText(t.sync.notices.waiting)).toBeTruthy();
    expect(t.sync.notices.waiting).toMatch(/can’t be shown yet/);
    expect(de.sync.notices.waiting).toMatch(/kann noch nicht angezeigt werden/);
    const dismiss = screen.getByRole('button', { name: 'Dismiss: notice about a shared team' });
    expect(de.sync.notices.dismissLabel(de.sync.notices.aTeam)).toBe(
      'Schließen: Hinweis zu einem geteilten Team',
    );
    await fireEvent.press(dismiss);
    expect(useSyncRuntime.getState().notices).toEqual([]);
  });

  it('names a record that can’t be synced, and why (audit M3, M4)', async () => {
    const unsent: SyncNotice = {
      kind: 'unsent',
      teamId: 'u',
      teamName: 'Foxtrot',
      count: 1,
      label: 'Anna Meier',
      reason: 'tooLong',
    };
    useSyncRuntime.setState({ notices: [unsent] });
    await renderApp('/teams');
    expect(
      screen.getByText(
        'Foxtrot: “Anna Meier” can’t be synced: a name is longer than 200 characters, or another text longer than 1000. Shorten it and it syncs by itself. Everything else syncs as usual.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: t.sync.notices.dismissLabel('Foxtrot') }),
    ).toBeTruthy();
    const en = t.sync.notices.unsent;
    expect(en('Foxtrot', '', 1, 'refused')).toBe(
      'Foxtrot: A record can’t be synced: the cloud refused it (too large, or with an id or a character the cloud can’t store). It stays on this device. Everything else syncs as usual.',
    );
    expect(en('Foxtrot', 'Динамо', 2, 'refused')).toContain('“Динамо” and 1 more record can’t');
    expect(en('Foxtrot', 'X', 4, 'tooLong')).toContain('“X” and 3 more records can’t');
    expect(en('Foxtrot', 'X', 1, 'invalid')).toBe(
      'Foxtrot: “X” can’t be synced: this app couldn’t read it back from the cloud (its data isn’t as expected). It stays on this device. Everything else syncs as usual.',
    );
    const german = de.sync.notices.unsent;
    expect(german('Foxtrot', 'Anna Meier', 1, 'tooLong')).toBe(
      'Foxtrot: „Anna Meier“ kann nicht synchronisiert werden: Ein Name ist länger als 200 Zeichen oder ein anderer Text länger als 1000. Kürze ihn, dann wird von selbst synchronisiert. Alles andere wird wie gewohnt synchronisiert.',
    );
    expect(german('Foxtrot', '', 1, 'refused')).toContain(
      'Ein Eintrag kann nicht synchronisiert werden: Die Cloud hat es abgelehnt',
    );
    expect(german('Foxtrot', 'X', 2, 'refused')).toContain(
      '„X“ und 1 weiterer Eintrag können nicht',
    );
    expect(german('Foxtrot', 'X', 3, 'invalid')).toContain(
      '„X“ und 2 weitere Einträge können nicht',
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
