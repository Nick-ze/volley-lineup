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
    /** v10 audit M15: why Delete is missing while another device scores a match live. */
    heldNoDelete: (name: string) =>
      name
        ? `Deleting isn’t possible while a match is being scored live on ${name}’s device.`
        : 'Deleting isn’t possible while a match is being scored live on another device.',
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
    /**
     * v10 audit M6: a team this account belongs to isn't on the device because its own record
     * hasn't arrived or can't be read. There is no team name to show.
     */
    waiting:
      'One of your shared teams can’t be shown yet: the cloud doesn’t have all of its data, or it was saved by a newer version of this app. It appears by itself once a manager’s device has synced. If it doesn’t, update the app.',
    /**
     * v10 audit M3, M4: records of the team that can't be saved to the cloud as they are. `label`
     * names the first one ('' when it has no name), `count` is how many there are.
     */
    unsent: (
      team: string,
      label: string,
      count: number,
      reason: 'tooLong' | 'invalid' | 'refused',
    ) => {
      const first = label === '' ? 'A record' : `“${label}”`;
      const what =
        count <= 1
          ? first
          : count === 2
            ? `${first} and 1 more record`
            : `${first} and ${count - 1} more records`;
      const why =
        reason === 'tooLong'
          ? 'a name is longer than 200 characters, or another text longer than 1000. Shorten it and it syncs by itself.'
          : reason === 'invalid'
            ? 'this app couldn’t read it back from the cloud (its data isn’t as expected). It stays on this device.'
            : 'the cloud refused it (too large, or with an id or a character the cloud can’t store). It stays on this device.';
      return `${team}: ${what} can’t be synced: ${why} Everything else syncs as usual.`;
    },
    /** In `dismissLabel`, for a notice about a team without a name. */
    aTeam: 'a shared team',
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
  /**
   * v10 audit M7: asked before a team's cloud version takes the place of an older copy of the
   * team on this device (joining again, downloading, sharing the copy).
   */
  localCopy: {
    title: 'Older copy on this device',
    /**
     * `viewOnly` / `managed`: the names of the teams this account may only view / may edit —
     * what happens to a copy differs.
     */
    body: (viewOnly: string[], managed: string[]) => {
      const all = [...viewOnly, ...managed];
      const found =
        all.length === 1
          ? `This device has an older copy of ${all[0]}.`
          : `This device has older copies of ${all.join(', ')}.`;
      const replaced =
        'The team’s cloud version takes its place, so changes made to the copy on this device are lost.';
      const merged =
        'The team’s cloud version wins wherever both have something, so changes made to the copy on this device are lost. What only the copy has is added to the team.';
      const effect =
        managed.length === 0
          ? replaced
          : viewOnly.length === 0
            ? merged
            : `Changes made to the copies on this device are lost: the cloud version takes the place of ${viewOnly.join(', ')}, and wins wherever both have something for ${managed.join(', ')} (what only that copy has is added to the team).`;
      return `${found} ${effect} Export a backup first?`;
    },
    /** What the backup is (the Settings export), under the question. */
    exportHint:
      'The backup is the same file as Settings → Export: everything on this device, with photos. Player descriptions are only in it if “Include descriptions” is switched on there.',
    export: 'Export a backup',
    exportLabel: 'Export a backup: the same file as Settings → Export',
    replace: 'Use the cloud version',
    replaceLabel: 'Use the cloud version: changes made to the copy on this device are lost',
    cancel: 'Not now',
    cancelLabel: 'Not now: keep the copy on this device',
    /** After "Not now" when joining: the account is a member, the copy is untouched. */
    later: (team: string) =>
      `You are a member of ${team} now. The copy on this device is unchanged. For the team’s cloud version, open Cloud sync → Cloud teams and download it.`,
    /** A team that was shared ("Share this team" / Upload) but is already in the cloud. */
    inCloud:
      'This team is already shared in the cloud and you are a member of it. This is an older copy: open Cloud sync → Cloud teams and download the team to link it.',
    openCloudTeams: 'Cloud teams',
    openCloudTeamsLabel: 'Cloud teams: download the team’s cloud version',
  },
  import: {
    shared: (names: string[]) => `Shared teams: ${names.join(', ')} (changes sync to all members).`,
    skipped: (names: string[]) => `View-only teams skipped: ${names.join(', ')}.`,
    replaceKeeps: 'Replace keeps the teams shared on this device.',
    sharedConflict:
      'This file clashes with a team shared on this device (for example two players with the same jersey number). Nothing was changed.',
    /** v10 audit M15: the file would change a match another device is scoring live. */
    liveMatch:
      'A match this file would change is being scored live on another device right now. Nothing was changed. Import again when that match is over.',
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
