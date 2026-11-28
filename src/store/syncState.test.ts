/**
 * v10 (store v13): the device-only sync state — migration, what "Delete all data", deleting a
 * profile and an import do to it, the atomic sync transaction, and that the export ignores it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { buildExport } from '@/domain/exportSchema';
import type { MatchHold, SyncData, SyncedTeam } from '@/domain/types';
import { resetStores, seedApp, TEAM_ID, makePlayer } from '@/test-utils';

import { emptyData, emptySync, selectAppData, STORAGE_KEY, useAppStore } from './appStore';
import { migrateStore } from './migrations';
import { prunePhotos, setPendingRemotePhotos, usePhotoStore } from './photoStore';
import { useCanEdit, useMatchAccess, useSharedTeamIds, useTeamAccess } from './syncHooks';
import { useSyncRuntime } from './syncRuntime';

const store = () => useAppStore.getState();
const NOW = new Date('2026-11-26T00:00:00Z');

const linked = (role: SyncedTeam['role']): SyncedTeam => ({
  userId: 'u1',
  role,
  cursor: 3,
  base: {},
  edits: {},
  photos: [],
});

const shared = (role: SyncedTeam['role'] = 'manager'): SyncData => ({
  deviceId: 'dev1',
  account: { userId: 'u1', email: 'a@example.test', profileId: 'prof1' },
  teams: { [TEAM_ID]: linked(role) },
});

beforeEach(() => resetStores());

describe('store v13 migration', () => {
  it('v12 → v13 adds an empty sync state and changes nothing else', () => {
    const v12 = { teams: [{ id: 't1', profileId: 'p', name: 'H', createdAt: '2026-01-01' }] };
    // (v12.0: the v13 → v14 step adds the empty hosted-tournament lists after it)
    const hosted = {
      hostedTournaments: [],
      hostedTeams: [],
      hostedResults: [],
      hostedPlayers: [],
    };
    expect(migrateStore(v12, 12)).toEqual({ ...v12, sync: emptySync(), ...hosted });
    // a state that already has one keeps it
    const v13 = { ...v12, sync: shared() };
    expect(migrateStore(v13, 12)).toEqual({ ...v13, ...hosted });
    expect(migrateStore(null, 12)).toBeNull();
  });

  it('v1 data migrates all the way to the current version', () => {
    const up = migrateStore({ profiles: [], teams: [], players: [], matches: [] }, 1) as Record<
      string,
      unknown
    >;
    expect(up.sync).toEqual({ deviceId: null, account: null, teams: {} });
    expect(up.tourMode).toBeNull();
  });
});

describe('sync state in the store', () => {
  it('starts without an account or shared teams', () => {
    expect(store().sync).toEqual({ deviceId: null, account: null, teams: {} });
  });

  it('is persisted with the data', async () => {
    store().setDeviceId('dev9');
    store().setSyncAccount({ userId: 'u1', email: 'a@example.test', profileId: 'p1' });
    await new Promise((r) => setTimeout(r, 0));
    const parsed = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) as string);
    expect(parsed.version).toBe(16);
    expect(parsed.state.sync).toEqual({
      deviceId: 'dev9',
      account: { userId: 'u1', email: 'a@example.test', profileId: 'p1' },
      teams: {},
    });
  });

  it('Delete all data forgets the account and shared teams but keeps the device id', () => {
    seedApp({ players: [makePlayer(1, 'Anna', ['S'])] });
    useAppStore.setState({ sync: shared() });
    store().resetAll();
    expect(store().sync).toEqual({ deviceId: 'dev1', account: null, teams: {} });
    expect(store().teams).toEqual([]);
  });

  it('deleting the linked profile unlinks the account; another profile does not', () => {
    seedApp({});
    const other = store().addProfile({ name: 'Other', color: '#FFC72C' });
    useAppStore.setState({ sync: shared() });
    store().deleteProfile(other.id);
    expect(store().sync.account?.profileId).toBe('prof1');
    store().deleteProfile('prof1');
    expect(store().sync.account).toBeNull();
    // v10 audit C1: the profile's shared teams are unlinked in the same write. (This test used
    // to expect the link to stay "for the engine to drop" — but signed out no cycle runs, and a
    // backup restored under the leftover link was pushed as deletions to every member.)
    expect(store().teams).toEqual([]);
    expect(store().sync.teams).toEqual({});
  });

  it('deleting a shared team unlinks it; other links stay', () => {
    seedApp({});
    const other = store().addTeam({ profileId: 'prof1', name: 'Other' });
    useAppStore.setState({
      sync: { ...shared(), teams: { ...shared().teams, [other.id]: shared().teams[TEAM_ID] } },
    });
    store().deleteTeam(TEAM_ID);
    expect(Object.keys(store().sync.teams)).toEqual([other.id]);
    expect(store().sync.account?.profileId).toBe('prof1');
  });

  it('an import keeps the sync state; the account goes when its profile is gone', () => {
    seedApp({});
    useAppStore.setState({ sync: shared() });
    const snapshot = selectAppData(store());
    store().replaceAll(snapshot);
    expect(store().sync).toEqual(shared());
    // A download that hasn't pulled anything yet has no team on the device: its link stays.
    const downloading: SyncedTeam = { ...linked('player'), cursor: 0 };
    useAppStore.setState({ sync: { ...shared(), teams: { ...shared().teams, dl: downloading } } });
    store().replaceAll(emptyData());
    expect(store().sync.account).toBeNull();
    // v10 audit C1: the shared team isn't in the new data, so its link goes with it. (This
    // test used to expect the link to stay; the import itself keeps shared teams in the data
    // it passes, `importWithSharedTeams`, so a link only loses its team here when it was stale.)
    expect(store().sync.teams).toEqual({ dl: downloading });
    // without an account nothing changes
    store().replaceAll(emptyData());
    expect(store().sync.account).toBeNull();
  });

  it('syncTransaction writes data and sync state in one update', () => {
    seedApp({});
    const seen: number[] = [];
    const unsubscribe = useAppStore.subscribe(() => seen.push(1));
    store().syncTransaction((s) => ({
      teams: s.teams.map((t) => ({ ...t, name: 'Renamed' })),
      sync: { ...s.sync, teams: { [TEAM_ID]: linked('manager') } },
    }));
    unsubscribe();
    expect(seen).toHaveLength(1);
    expect(store().teams[0]?.name).toBe('Renamed');
    expect(store().sync.teams[TEAM_ID]?.role).toBe('manager');
  });

  it('the export ignores the sync state', () => {
    seedApp({ players: [makePlayer(1, 'Anna', ['S'])] });
    const before = buildExport({ ...selectAppData(store()), photos: [] }, { now: NOW });
    useAppStore.setState({ sync: shared() });
    const after = buildExport({ ...selectAppData(store()), photos: [] }, { now: NOW });
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
    expect(after.schemaVersion).toBe(13);
  });
});

describe('pending remote photos', () => {
  it('the prune keeps a photoId whose photo is still being downloaded', async () => {
    seedApp({ players: [makePlayer(1, 'Anna', ['S'], { photoId: 'remote1' })] });
    usePhotoStore.setState({ hydrated: true });
    setPendingRemotePhotos(new Set(['remote1']));
    await prunePhotos();
    expect(store().players[0]?.photoId).toBe('remote1');
    setPendingRemotePhotos(new Set());
    await prunePhotos();
    expect(store().players[0]?.photoId).toBeUndefined();
  });
});

describe('sync hooks', () => {
  const hold = (deviceId: string, heldUntil: string): MatchHold => ({
    matchId: 'm1',
    teamId: TEAM_ID,
    deviceId,
    userId: 'u2',
    holderName: 'Anna',
    heldUntil,
  });

  it('local teams are editable; shared teams follow the cached role', async () => {
    seedApp({});
    const { result, rerender } = await renderHook(() => ({
      access: useTeamAccess(TEAM_ID),
      canEdit: useCanEdit(TEAM_ID),
      none: useTeamAccess(undefined),
      ids: useSharedTeamIds(),
    }));
    expect(result.current.canEdit).toBe(true);
    expect(result.current.ids).toEqual([]);
    expect(result.current.none.shared).toBe(false);
    await act(async () => useAppStore.setState({ sync: shared('player') }));
    await rerender({});
    expect(result.current.access).toEqual({
      shared: true,
      role: 'player',
      canEdit: false,
      block: 'viewer',
    });
    expect(result.current.ids).toEqual([TEAM_ID]);
  });

  it('a match held by another device is read-only until the hold runs out', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-11-26T10:00:00Z') });
    try {
      seedApp({});
      const match = store().addMatch({
        teamId: TEAM_ID,
        seasonId: 's1',
        opponentId: 'o1',
        opponent: 'Lions',
        date: '2026-11-26',
        home: true,
      });
      useAppStore.setState({ sync: shared('manager') });
      useSyncRuntime.setState({ holds: { [match.id]: hold('dev2', '2026-11-26T10:01:00Z') } });
      const { result } = await renderHook(() => useMatchAccess(match.id));
      expect(result.current).toEqual({ canEdit: false, block: 'held', holder: 'Anna' });
      await act(async () => {
        jest.advanceTimersByTime(61_000);
      });
      expect(result.current).toEqual({ canEdit: true, block: null });
      const unknown = await renderHook(() => useMatchAccess('nope'));
      expect(unknown.result.current).toEqual({ canEdit: true, block: null });
    } finally {
      jest.useRealTimers();
    }
  });
});
