/**
 * v10: the real barrel (not the Jest mock). Without a configured backend or a session nothing
 * reaches the network and every command resolves with an error code.
 */
import type * as Sync from '@/lib/sync';

const sync = jest.requireActual<typeof Sync>('@/lib/sync');

describe('the sync barrel', () => {
  it('without a backend config: start does nothing, commands say "not signed in"', async () => {
    expect(sync.isSyncConfigured()).toBe(false);
    const stop = sync.startSync();
    expect(stop()).toBeUndefined();
    expect(await sync.requestCode('anna@example.test')).toEqual({
      ok: false,
      error: 'notSignedIn',
    });
    expect(await sync.verifyCode('anna@example.test', '123456')).toEqual({
      ok: false,
      error: 'notSignedIn',
    });
    const notSignedIn = { ok: false, error: 'notSignedIn' };
    expect(await sync.listCloudTeams()).toEqual(notSignedIn);
    expect(await sync.uploadTeams(['t1'])).toEqual(notSignedIn);
    expect(await sync.downloadTeams(['t1'])).toEqual(notSignedIn);
    expect(await sync.deleteTeamEverywhere('t1')).toEqual(notSignedIn);
    expect(await sync.leaveTeam('t1')).toEqual(notSignedIn);
    expect(await sync.listMembers('t1')).toEqual(notSignedIn);
    expect(await sync.setMemberRole('t1', 'u', 'player')).toEqual(notSignedIn);
    expect(await sync.removeMember('t1', 'u')).toEqual(notSignedIn);
    expect(await sync.listInvites('t1')).toEqual(notSignedIn);
    expect(await sync.createInvite('t1', 'player', 7)).toEqual(notSignedIn);
    expect(await sync.revokeInvite('i')).toEqual(notSignedIn);
    expect(await sync.joinTeam('ABCDEFGHJK')).toEqual(notSignedIn);
    expect(await sync.accountDeletionCheck()).toEqual(notSignedIn);
    expect(await sync.deleteAccount()).toEqual(notSignedIn);
    expect(await sync.holdMatch('t1', 'm1')).toEqual(notSignedIn);
    await expect(sync.releaseMatch('t1', 'm1')).resolves.toBeUndefined();
    await expect(sync.syncNow()).resolves.toBeUndefined();
    sync.followMatch('m1');
    sync.followMatch(null);
    sync.linkAccountToProfile('pr1');
    sync.unlinkTeam('t1');
    await expect(sync.signOut()).resolves.toBeUndefined();
  });
});
