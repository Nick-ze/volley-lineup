/** Strings for Worker D — export / import / settings. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const transfer = {
  profile: {
    title: 'Profile',
    current: (name: string) => `Signed in as ${name}`,
    none: 'No profile selected.',
    switch: 'Switch profile',
  },
  export: {
    title: 'Export',
    hint: 'Save your data as a .json file to keep a backup or move it to another device.',
    all: 'Export everything',
    team: (name: string) => `Export ${name}`,
    teamLabel: (name: string) => `Export only the team ${name}`,
    teamsHeading: 'Export one team',
    noTeams: 'The current profile has no teams yet.',
    dialogTitle: 'Export Volley Lineup data',
    done: (fileName: string) => `Exported ${fileName}.`,
    failed: 'Export failed. Please try again.',
  },
  import: {
    title: 'Import',
    hint: 'Load a .json file exported from Volley Lineup.',
    pick: 'Import from file',
    previewTitle: (fileName: string) => `Ready to import ${fileName}`,
    summary: (s: { profiles: number; teams: number; players: number; matches: number }) =>
      [
        plural(s.teams, 'team', 'teams'),
        plural(s.players, 'player', 'players'),
        plural(s.matches, 'match', 'matches'),
        plural(s.profiles, 'profile', 'profiles'),
      ].join(', '),
    mergeHint: 'Merge adds the file to your data; items that already exist are updated.',
    replaceHint: 'Replace deletes all current data and keeps only the file’s data.',
    merge: 'Merge',
    replace: 'Replace',
    cancel: 'Cancel import',
    doneMerge: 'Import complete: data merged.',
    doneReplace: 'Import complete: data replaced.',
    errors: {
      INVALID_JSON: 'This file is not valid JSON. Nothing was changed.',
      NOT_VOLLEY_LINEUP: 'This file is not a Volley Lineup export. Nothing was changed.',
      UNSUPPORTED_VERSION:
        'This file was made by a different version of Volley Lineup and can’t be read. Nothing was changed.',
      INVALID_SHAPE: 'This file is damaged or incomplete. Nothing was changed.',
      INCONSISTENT_REFERENCES:
        'This file contains data that doesn’t fit together (for example a player in an unknown team). Nothing was changed.',
      MERGE_CONFLICT:
        'Merging would give two players the same jersey number in one team. Nothing was changed — use Replace, or fix the numbers first.',
      READ_FAILED: 'The file could not be read. Nothing was changed.',
    },
  },
  danger: {
    title: 'Delete all data',
    hint: 'Removes every profile, team, player and match from this device.',
    button: 'Delete all data',
    confirmTitle: 'Delete everything?',
    confirmBody: 'This can’t be undone. Export your data first if you want a backup.',
    confirm: 'Yes, delete everything',
    cancel: 'Keep my data',
    done: 'All data deleted.',
  },
  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    unknownVersion: 'unknown',
  },
} as const;
