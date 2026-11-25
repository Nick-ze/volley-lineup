import { holdStatus, matchAccess, teamAccess } from './syncAccess';
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
