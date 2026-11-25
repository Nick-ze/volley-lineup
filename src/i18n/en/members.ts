import type { SyncErrorCode } from '@/domain/types';

/** v10: team members, roles, invite codes, joining a team. */
export const members = {
  title: 'Members',
  newInvite: 'New invite',
  newInviteLabel: 'New invite: create an invite code',
  roles: {
    manager: 'Manager',
    player: 'Player',
  },
  /** The role inside a sentence ("You joined Herren 1 as manager."). */
  roleInText: {
    manager: 'manager',
    player: 'player',
  },
  header: {
    members: 'Members',
    membersLabel: (team: string) => `Members: who is in ${team}`,
    share: 'Share',
    shareLabel: (team: string) => `Share: invite others to ${team}`,
  },
  local: {
    intro:
      'This team is only on this device. Share it to use it on your other devices and to invite managers and players. Players can only view it.',
    signInNeeded: 'You need an account to share a team.',
    signIn: 'Sign in first',
    signInLabel: 'Sign in first: you need an account',
    share: 'Share this team',
    shareLabel: (team: string) => `Share this team: upload ${team} to the cloud`,
    sharing: 'Sharing…',
  },
  list: {
    heading: 'Members',
    loading: 'Loading members…',
    you: '(you)',
    noName: 'No name',
    retry: 'Try again',
    retryLabel: 'Try again: load the members',
    makeManager: 'Make manager',
    makeManagerLabel: (name: string) => `Make manager: ${name}`,
    makePlayer: 'Make player',
    makePlayerLabel: (name: string) => `Make player: ${name}`,
    remove: 'Remove',
    removeLabel: (name: string) => `Remove: ${name} from the team`,
    removeConfirm: (name: string) =>
      `Remove ${name} from the team? They keep a copy on their device but get no more changes.`,
  },
  invites: {
    heading: 'Invites',
    none: 'No active invites. Create one and share it with your team.',
    details: (role: string, date: string, uses: number) =>
      `${role} · valid until ${date} · used ${uses}×`,
    share: 'Share',
    shareLabel: (code: string) => `Share: invite code ${code}`,
    copy: 'Copy',
    copyLabel: (code: string) => `Copy: invite code ${code}`,
    copied: 'Copied.',
    shareFailed: 'Could not share. Read the code out instead.',
    revoke: 'Revoke',
    revokeLabel: (code: string) => `Revoke: invite code ${code}`,
    revokeConfirm: (code: string) => `Revoke the invite ${code}? It stops working at once.`,
    shareTitle: (team: string) => `Join ${team}`,
    shareMessage: (team: string, code: string, link: string) =>
      `Join “${team}” in Volley Lineup: open ${link} or enter the code ${code} under Join a team.`,
  },
  newInviteDialog: {
    title: 'New invite',
    role: 'Role',
    roleHint: {
      manager: 'Managers can change everything, invite and remove people.',
      player: 'Players can only view the team.',
    },
    days: 'Valid for',
    dayOption: (days: number) => (days === 1 ? '1 day' : `${days} days`),
    create: 'Create',
    createLabel: 'Create: make the invite code',
  },
  leave: {
    button: 'Leave team',
    label: (team: string) => `Leave team: ${team}`,
    confirm: (team: string) =>
      `Leave ${team}? It is removed from this device and you get no more changes.`,
    confirmButton: 'Leave',
  },
  errors: {
    offline: 'Needs a connection. Try again when you are online.',
    forbidden: 'Only managers can do that.',
    lastManager: 'Make someone else manager first.',
    lastMember: 'You’re the only member: delete the team instead.',
    inviteInvalid: 'This code is invalid or expired.',
    notSignedIn: 'Sign in first.',
    signedOut: 'You were signed out. Sign in again.',
    invalidCode: 'This code is invalid or expired.',
    rateLimited: 'Too many tries. Wait a moment and try again.',
    tooMany: 'Too many invites or teams. Revoke an invite or remove a team first.',
    unknown: 'Something went wrong. Try again.',
  } satisfies Record<SyncErrorCode, string>,
  join: {
    title: 'Join a team',
    intro: 'Enter the invite code you got from a team manager, or paste the invite link.',
    code: 'Invite code',
    placeholder: 'ABCDE-FGHJK',
    badFormat: 'An invite code has 10 letters and digits, like ABCDE-FGHJK.',
    submit: 'Join',
    submitLabel: 'Join: join the team with this code',
    joining: 'Joining…',
    signInNeeded: 'You need an account to join a team.',
    joined: (team: string, role: string) => `You joined ${team} as ${role}.`,
    joinedUnnamed: (role: string) => `You joined the team as ${role}.`,
    open: 'Open team',
    openLabel: (team: string) => `Open team: ${team}`,
  },
};
