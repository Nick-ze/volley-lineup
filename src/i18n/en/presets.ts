/** Team nav bar, lineup presets and team starters (v3). */
export const presets = {
  nav: {
    label: 'Team sections',
    roster: 'Roster',
    matches: 'Matches',
    presets: 'Presets',
    starters: 'Starters',
    stats: 'Stats',
    rosterLabel: 'Roster: players of the team',
    matchesLabel: 'Matches of the team',
    presetsLabel: 'Presets: saved lineups',
    startersLabel: 'Starters: the team’s usual starting lineup',
    statsLabel: 'Stats: season statistics of the team',
  },
  list: {
    count: (n: number) => (n === 1 ? '1 preset' : `${n} presets`),
    add: 'New preset',
    addLabel: 'New preset: create a saved lineup',
    empty:
      'No presets yet. Save lineups you use often (for example “5-1 strong serve”) and apply them to any set.',
    summary: (filled: number, libero: boolean) => `${filled}/6${libero ? ' + L' : ''}`,
    summaryLabel: (filled: number, libero: boolean) =>
      `${filled} of 6 positions filled${libero ? ', with libero' : ''}`,
    open: (name: string) => `${name}: edit preset`,
    renameLabel: (name: string) => `Rename preset ${name}`,
    duplicate: 'Copy',
    duplicateLabel: (name: string) => `Copy preset ${name}`,
    copyName: (name: string) => `${name} (copy)`,
    deleteLabel: (name: string) => `Delete preset ${name}`,
    confirmDelete: (name: string) => `Delete the preset “${name}”? Matches are not changed.`,
    defaultName: 'Preset',
  },
  nameDialog: {
    newTitle: 'New preset',
    renameTitle: 'Rename preset',
    name: 'Name',
    placeholder: 'e.g. 5-1 strong serve',
    create: 'Create',
    save: 'Save',
    errors: {
      required: 'Enter a name.',
      tooLong: 'Use at most 40 characters.',
      taken: 'This team already has a preset with this name.',
    },
  },
  editor: {
    title: (name: string) => `Preset: ${name}`,
    rename: 'Rename',
    renameLabel: 'Rename this preset',
    notFound: 'This preset no longer exists.',
    startersHint:
      'The starters fill set 1 of every new match. You can also apply them to any set in the match screen.',
    presetHint: 'Changes are saved automatically. Apply this preset to a set in the match screen.',
  },
  starters: {
    heading: 'Starting lineup',
    empty:
      'No starters yet. Set the team’s usual starting six and libero once; new matches start with them.',
    set: 'Set starters',
    setLabel: 'Set starters of the team',
    edit: 'Edit starters',
    editLabel: 'Edit starters of the team',
    incomplete: (filled: number) =>
      `${filled} of 6 positions set. New matches start with them in set 1; pick the other players in the match before the game.`,
    complete: 'New matches start with this lineup in set 1.',
    leftOut: (n: number) =>
      n === 1
        ? '1 of these players is injured and will be left out of new matches.'
        : `${n} of these players are injured and will be left out of new matches.`,
    libero: (name: string) => `Libero: ${name}`,
    noLibero: 'No libero',
    courtLabel: (summary: string) => `Starters: ${summary}`,
  },
  apply: {
    useStarters: 'Use team starters',
    useStartersLabel: 'Fill this set with the team’s starters',
    noStarters: 'The team has no starters yet (team screen › Starters).',
    applyPreset: 'Apply preset…',
    applyPresetLabel: 'Choose a preset to fill this set',
    noPresets: 'The team has no presets yet (team screen › Presets).',
    choose: 'Choose a preset:',
    presetLabel: (name: string) => `${name}: apply this preset to this set`,
    cancel: 'Cancel',
    cancelLabel: 'Cancel: close the preset list',
    locked: 'This set has been played; reset its live data to change the lineup.',
    applied: (name: string) => `Applied ${name}.`,
    startersName: 'the team starters',
    skipped: (name: string, players: string) =>
      `Applied ${name}. Left out (injured or no longer in the team): ${players}.`,
    unknownPlayer: 'a removed player',
  },
} as const;
