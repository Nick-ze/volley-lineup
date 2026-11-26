import type { SyncErrorCode } from '@/domain/types';

/** v10: sync status and view-only reasons (shared by the account screen and every feature). */
export const sync = {
  /**
   * v10 audit M16: every error a sync command can return, as one short message for every screen
   * (sign-in, cloud sync, members, join, deleting a shared team).
   */
  errors: {
    offline: 'No connection. Try again when you’re online.',
    forbidden: 'You’re not allowed to do that.',
    lastManager: 'Make someone else manager first.',
    lastMember: 'You’re the only member: delete the team for everyone instead.',
    inviteInvalid: 'This invite code is wrong, has expired or was already used.',
    notSignedIn: 'Sign in first (Profile → Cloud sync).',
    signedOut: 'You were signed out. Sign in again.',
    invalidCode: 'Wrong or expired code. Check the email or send a new code.',
    rateLimited: 'Too many tries. Wait a moment and try again.',
    tooMany:
      'Limit reached: at most 10 teams per account, and 20 open invites and 20 MB of data per team.',
    mailFailed: 'The email with the code couldn’t be sent. Try again later.',
    emailRejected: 'This email address can’t be used to sign in. Check it or use another one.',
    unknown: 'Something went wrong. Try again.',
  } satisfies Record<SyncErrorCode, string>,
  status: {
    off: 'Not signed in',
    /** Signed in, but no team of the account is shared on this device. */
    noTeams: 'No shared teams',
    synced: 'Synced',
    syncing: 'Syncing…',
    offline: 'Offline',
    error: 'Sync error',
    pending: (n: number) => (n === 1 ? '1 change waiting' : `${n} changes waiting`),
    syncNow: 'Sync now',
  },
  readOnly: {
    viewer: 'View only: only managers can change this team.',
    held: (name: string) =>
      name ? `Being scored live on ${name}’s device.` : 'Being scored live on another device.',
    takeOver: 'Take over',
  },
  // E2: status badge, notices, deleting a shared team, import, team list.
  badge: {
    offlinePending: (n: number) => `Offline (${n})`,
    /** Starts with the badge's visible text. */
    label: (text: string) => `${text}: open cloud sync`,
  },
  notices: {
    /**
     * The server can't tell a removal from "delete for everyone" (DECISIONS #284), so the text
     * names both (v10 audit L24).
     */
    removed: (team: string) =>
      `You’re no longer a member of ${team}: you were removed or the team was deleted. It stays on this device as a local copy.`,
    deleted: (team: string) =>
      `${team} was deleted from the cloud. It stays on this device as a local copy.`,
    demoted: (team: string, undone: number) =>
      undone === 0
        ? `You can now only view ${team}.`
        : undone === 1
          ? `You can now only view ${team}; 1 unsynced change was undone.`
          : `You can now only view ${team}; ${undone} unsynced changes were undone.`,
    skipped: (team: string, count: number) =>
      count === 1
        ? `${team}: 1 record from the cloud couldn’t be read and was skipped.`
        : `${team}: ${count} records from the cloud couldn’t be read and were skipped.`,
    /** v10 audit M1: another device took over scoring; this device's unsynced changes gave way. */
    takenOver: (team: string, holder: string, undone: number) =>
      `${holder || 'Someone else'} took over scoring a match of ${team}. ` +
      (undone === 1
        ? '1 change made here that hadn’t synced yet was undone.'
        : `${undone} changes made here that hadn’t synced yet were undone.`),
    dismiss: 'Dismiss',
    dismissLabel: (team: string) => `Dismiss: notice about ${team}`,
  },
  teamDelete: {
    title: (team: string) => `Delete ${team}?`,
    /** The player role's title (they can only remove the team here or leave it). */
    removeTitle: (team: string) => `Remove ${team}?`,
    managerBody:
      'This team is shared. Remove it from this device only (it stays in the cloud for everyone), or delete it for everyone.',
    playerBody:
      'This team is shared with you. Remove it from this device only (you stay a member), or leave the team.',
    removeHere: 'Remove from this device',
    removeHereLabel: (team: string) => `Remove from this device: ${team}`,
    deleteEverywhere: 'Delete for everyone',
    deleteEverywhereLabel: (team: string) => `Delete for everyone: ${team}`,
    leave: 'Leave team',
    leaveLabel: (team: string) => `Leave team: ${team}`,
    cancel: 'Cancel',
    cancelLabel: 'Cancel: keep the team',
  },
  import: {
    shared: (names: string[]) => `Shared teams: ${names.join(', ')} (changes sync to all members).`,
    skipped: (names: string[]) => `View-only teams skipped: ${names.join(', ')}.`,
    replaceKeeps: 'Replace keeps the teams shared on this device.',
    sharedConflict:
      'This file clashes with a team shared on this device (for example two players with the same jersey number). Nothing was changed.',
  },
  team: {
    /** A team row's accessibility label plus its "Shared" / "View only" mark. */
    rowLabel: (open: string, mark: string) => `${open}. ${mark}`,
    markSeparator: ' · ',
    join: 'Join a team',
    joinLabel: 'Join a team: with an invite code',
  },
  shared: 'Shared',
  viewOnly: 'View only',
  /** v10 (E1): the match side (builder, live, presets) for view-only members and held matches. */
  match: {
    notStarted: (set: number) => `Set ${set} hasn’t started yet.`,
    takeOverFailed: {
      offline: 'Taking over needs a connection.',
      forbidden: 'Only managers can take over.',
      other: 'Couldn’t take over. Try again.',
    },
  },
};
