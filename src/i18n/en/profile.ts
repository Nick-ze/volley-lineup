/** Strings for the bottom tab bar and the Profile tab (edit, switch, log out, delete). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const profile = {
  tabs: {
    teams: 'Teams',
    profile: 'Profile',
    settings: 'Settings',
    teamsLabel: 'Teams tab',
    profileLabel: 'Profile tab',
    settingsLabel: 'Settings tab',
  },
  current: 'Signed in as',
  counts: (teams: number, players: number) =>
    `${plural(teams, 'team', 'teams')} · ${plural(players, 'player', 'players')}`,
  edit: 'Edit profile',
  editLabel: (name: string) => `Edit profile ${name}`,
  account: 'Account',
  switch: 'Switch profile',
  switchHint: 'Open another profile on this device.',
  logout: 'Log out',
  logoutNote: 'Your data stays on this device.',
  dangerTitle: 'Delete profile',
  dangerHint: 'Deletes this profile with all its teams, players and matches.',
  delete: 'Delete profile',
  deleteLabel: (name: string) => `Delete profile ${name}`,
} as const;
