import {
  goneTeamLinks,
  holdStatus,
  isGoneLink,
  matchAccess,
  teamAccess,
  withoutTeamLinks,
} from './syncAccess';
import type { MatchHold, SyncData, SyncedTeam } from './types';

const linked = (role: SyncedTeam['role']): SyncedTeam => ({
  userId: 'u1',
  role,
  cursor: 0,
  base: {},
  edits: {},
  photos: [],
});

const sync: SyncData = {
  deviceId: 'dev1',
  account: { userId: 'u1', email: 'a@example.test', profileId: 'p1' },
  teams: { mgr: linked('manager'), view: linked('player') },
};

const NOW = Date.parse('2026-11-26T10:00:00Z');
const hold = (deviceId: string, heldUntil = '2026-11-26T10:10:00Z'): MatchHold => ({
  matchId: 'm1',
  teamId: 'mgr',
  deviceId,
  userId: 'u2',
  holderName: 'Anna',
  heldUntil,
});

describe('teamAccess', () => {
  it('local teams are editable as before v10', () => {
    expect(teamAccess(sync, 'local')).toEqual({
      shared: false,
      role: null,
      canEdit: true,
      block: null,
    });
  });
  it('managers edit shared teams; players only view', () => {
    expect(teamAccess(sync, 'mgr')).toEqual({
      shared: true,
      role: 'manager',
      canEdit: true,
      block: null,
    });
    expect(teamAccess(sync, 'view')).toEqual({
      shared: true,
      role: 'player',
      canEdit: false,
      block: 'viewer',
    });
  });
});

describe('holdStatus', () => {
  it('none without a hold or after it expired', () => {
    expect(holdStatus(undefined, 'dev1', NOW)).toBe('none');
    expect(holdStatus(hold('dev2', '2026-11-26T10:00:00Z'), 'dev1', NOW)).toBe('none');
  });
  it('mine for this device, other for another device', () => {
    expect(holdStatus(hold('dev1'), 'dev1', NOW)).toBe('mine');
    expect(holdStatus(hold('dev2'), 'dev1', NOW)).toBe('other');
    expect(holdStatus(hold('dev2'), null, NOW)).toBe('other');
  });
});

describe('matchAccess', () => {
  it('local teams and free matches are editable', () => {
    expect(matchAccess(sync, 'local', hold('dev2'), NOW)).toEqual({ canEdit: true, block: null });
    expect(matchAccess(sync, 'mgr', undefined, NOW)).toEqual({ canEdit: true, block: null });
    expect(matchAccess(sync, 'mgr', hold('dev1'), NOW)).toEqual({ canEdit: true, block: null });
  });
  it('viewers never edit', () => {
    expect(matchAccess(sync, 'view', undefined, NOW)).toEqual({ canEdit: false, block: 'viewer' });
  });
  it('a match held by another device is read-only with the holder', () => {
    expect(matchAccess(sync, 'mgr', hold('dev2'), NOW)).toEqual({
      canEdit: false,
      block: 'held',
      holder: 'Anna',
    });
  });
});

describe('links of teams that left the device (audit C1)', () => {
  const synced = (patch: Partial<SyncedTeam>): SyncedTeam => ({ ...linked('manager'), ...patch });
  const base = { 'team:t1': { v: 3, h: 'abc', at: '2026-11-26T10:00:00.000Z' } };

  it('a link is gone when its team is missing and it has synced before', () => {
    expect(isGoneLink(synced({ cursor: 7 }), false)).toBe(true);
    expect(isGoneLink(synced({ base }), false)).toBe(true);
    // Still on the device: never gone.
    expect(isGoneLink(synced({ cursor: 7, base }), true)).toBe(false);
    // Linked but nothing pulled yet (a download under way): not gone.
    expect(isGoneLink(synced({}), false)).toBe(false);
  });

  it('lists the gone links of the sync state', () => {
    const teams = {
      here: synced({ cursor: 4 }),
      gone: synced({ cursor: 4 }),
      goneViewer: { ...linked('player'), base },
      downloading: synced({}),
    };
    expect(goneTeamLinks({ teams }, [{ id: 'here' }, { id: 'other' }])).toEqual([
      'gone',
      'goneViewer',
    ]);
    expect(goneTeamLinks({ teams: {} }, [])).toEqual([]);
  });

  it('removes links; the same object when none of the ids is linked', () => {
    const next = withoutTeamLinks(sync, ['mgr', 'unknown']);
    expect(Object.keys(next.teams)).toEqual(['view']);
    expect(next.account).toBe(sync.account);
    expect(Object.keys(sync.teams)).toEqual(['mgr', 'view']); // not changed
    expect(withoutTeamLinks(sync, ['unknown'])).toBe(sync);
    expect(withoutTeamLinks(sync, new Set<string>())).toBe(sync);
  });
});
