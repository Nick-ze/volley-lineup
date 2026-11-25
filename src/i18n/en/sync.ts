/** v10: sync status and view-only reasons (shared by the account screen and every feature). */
export const sync = {
  status: {
    off: 'Not signed in',
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
