/**
 * v10: Jest mock of `@/lib/sync` (enabled for every test in jest.setup.ts). Commands resolve
 * successfully with empty values; tests override them with `jest.mocked(sync.x).mockResolvedValue`.
 * Nothing here touches the network.
 */
const ok = <T>(value: T) => jest.fn(async () => ({ ok: true as const, value }));

export const isSyncConfigured = jest.fn(() => true);
export const startSync = jest.fn(() => () => undefined);
export const syncNow = jest.fn(async () => undefined);
export const followMatch = jest.fn();
export const requestCode = ok(undefined);
export const verifyCode = jest.fn(async () => ({
  ok: true as const,
  value: { userId: 'user-1', switchedFrom: null },
}));
export const linkAccountToProfile = jest.fn();
export const signOut = jest.fn(async () => undefined);
export const accountDeletionCheck = ok({
  deleteTeams: [] as string[],
  blockedTeams: [] as string[],
});
export const deleteAccount = ok(undefined);
export const listCloudTeams = ok([]);
export const uploadTeams = ok([]);
export const downloadTeams = ok<string[]>([]);
export const deleteTeamEverywhere = ok(undefined);
export const leaveTeam = ok(undefined);
export const unlinkTeam = jest.fn();
export const listMembers = ok([]);
export const setMemberRole = ok(undefined);
export const removeMember = ok(undefined);
export const listInvites = ok([]);
export const createInvite = jest.fn(async () => ({
  ok: true as const,
  value: {
    id: 'inv-1',
    code: 'ABCDEFGHJK',
    role: 'player' as const,
    expiresAt: '2026-12-03T00:00:00.000Z',
    revokedAt: null,
    uses: 0,
    maxUses: null,
  },
}));
export const revokeInvite = ok(undefined);
export const joinTeam = jest.fn(async () => ({
  ok: true as const,
  value: {
    teamId: 'team-1',
    role: 'player' as const,
    name: null as string | null,
    localCopy: false as boolean,
  },
}));
export const holdMatch = jest.fn(async () => ({ ok: true as const, value: { granted: true } }));
export const releaseMatch = jest.fn(async () => undefined);
