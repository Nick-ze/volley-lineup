import {
  goneTeamLinks,
  holdStatus,
  isGoneLink,
  matchAccess,
  teamAccess,
  withoutTeamLinks,
  yieldedMatches,
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

describe('yieldedMatches (audit M1: a match another device took over from this one)', () => {
  const ME = 'dev1';
  const none = new Set<string>();
  const mine = { m1: hold(ME) };
  const theirs = { m1: hold('dev2') };

  it('yields a match this device was scoring once another device holds it', () => {
    expect([...yieldedMatches(none, mine, theirs, ME, NOW)]).toEqual(['m1']);
  });

  it('also when this device’s own hold had run out (offline for a while)', () => {
    const expired = { m1: hold(ME, '2026-11-26T09:50:00Z') };
    expect([...yieldedMatches(none, expired, theirs, ME, NOW)]).toEqual(['m1']);
  });

  it('also when the holder’s device isn’t known (a refused claim)', () => {
    expect([...yieldedMatches(none, mine, { m1: hold('') }, ME, NOW)]).toEqual(['m1']);
  });

  it('never yields a match this device didn’t hold', () => {
    expect(yieldedMatches(none, {}, theirs, ME, NOW).size).toBe(0);
    expect(yieldedMatches(none, theirs, theirs, ME, NOW).size).toBe(0);
    expect(yieldedMatches(none, { m2: { ...hold(ME), matchId: 'm2' } }, theirs, ME, NOW).size).toBe(
      0,
    );
  });

  it('stays yielded while the other hold lasts, whatever this device knew last', () => {
    const yielded = new Set(['m1']);
    expect([...yieldedMatches(yielded, theirs, theirs, ME, NOW)]).toEqual(['m1']);
    expect([...yieldedMatches(yielded, {}, { m1: hold('dev3') }, ME, NOW)]).toEqual(['m1']);
  });

  it('ends when the other hold is released, has run out or was taken back here', () => {
    const yielded = new Set(['m1']);
    expect(yieldedMatches(yielded, theirs, {}, ME, NOW).size).toBe(0);
    const expired = { m1: hold('dev2', '2026-11-26T10:00:00Z') };
    expect(yieldedMatches(yielded, theirs, expired, ME, NOW).size).toBe(0);
    expect(yieldedMatches(yielded, theirs, mine, ME, NOW).size).toBe(0);
  });

  it('keeps each match apart', () => {
    const m2 = { ...hold('dev2'), matchId: 'm2' };
    const out = yieldedMatches(none, { m1: hold(ME), m2 }, { m1: hold('dev2'), m2 }, ME, NOW);
    expect([...out]).toEqual(['m1']);
  });

  it('yields nothing without a device id', () => {
    expect(yieldedMatches(new Set(['m1']), { m1: hold('') }, { m1: hold('') }, '', NOW).size).toBe(
      0,
    );
    expect(yieldedMatches(none, mine, theirs, null, NOW).size).toBe(0);
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
