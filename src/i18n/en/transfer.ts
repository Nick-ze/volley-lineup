/** Strings for Worker D — export / import / settings. */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const transfer = {
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
    includeDescriptions: 'Include descriptions',
    includeDescriptionsHint:
      'Off by default: confidential player descriptions stay out of the file. Only available while descriptions are unlocked.',
    checkMark: '✓',
    includeDescriptionsLocked: 'Unlock the descriptions to include them.',
  },
  import: {
    title: 'Import',
    hint: 'Load a .json file exported from Volley Lineup.',
    pick: 'Import from file',
    previewTitle: (fileName: string) => `Ready to import ${fileName}`,
    summary: (s: {
      profiles: number;
      teams: number;
      players: number;
      matches: number;
      presets: number;
      seasons: number;
    }) =>
      [
        plural(s.teams, 'team', 'teams'),
        plural(s.players, 'player', 'players'),
        plural(s.matches, 'match', 'matches'),
        plural(s.seasons, 'season / tournament', 'seasons / tournaments'),
        plural(s.presets, 'saved lineup', 'saved lineups'),
        plural(s.profiles, 'profile', 'profiles'),
      ].join(', '),
    descriptions: (n: number) =>
      n === 1 ? 'Includes 1 player description.' : `Includes ${n} player descriptions.`,
    mergeHint:
      'Merge adds the file to your data; items that already exist are updated. Team starters in the file replace yours.',
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
        'Merging would make your data inconsistent (for example two players with the same jersey number in one team). Nothing was changed — use Replace instead.',
      READ_FAILED: 'The file could not be read. Nothing was changed.',
    },
  },
  danger: {
    title: 'Delete all data',
    hint: 'Removes every profile, team, player, photo, season, match and saved lineup (presets and team starters) from this device.',
    button: 'Delete all data',
    confirmTitle: 'Delete everything?',
    confirmBody:
      'All profiles, teams, players, photos, seasons, matches and saved lineups (presets and team starters) will be deleted. This can’t be undone. Export your data first if you want a backup.',
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
