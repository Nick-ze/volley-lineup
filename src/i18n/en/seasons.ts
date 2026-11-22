/** v7.0: seasons / tournaments, their opponents and stats (worker A). */
export const seasons = {
  title: 'Season',
  kind: { season: 'Season', tournament: 'Tournament' },
  list: {
    empty: 'No seasons yet. Create a season or tournament to add matches.',
    newSeason: 'New season',
    matchCount: (n: number) => (n === 1 ? '1 match' : `${n} matches`),
    record: (won: number, lost: number) => `${won}–${lost}`,
    open: (summary: string) => `${summary}. Open`,
  },
  dates: (start?: string, end?: string) =>
    start && end ? `${start} – ${end}` : start ? `from ${start}` : end ? `until ${end}` : '',
  form: {
    newTitle: 'New season',
    editTitle: 'Edit season',
    name: 'Name',
    namePlaceholder: 'e.g. 2026/27 or Summer Cup',
    kind: 'Type',
    startDate: 'Start date (optional)',
    endDate: 'End date (optional)',
    datePlaceholder: 'YYYY-MM-DD',
    location: 'Place (optional)',
    create: 'Create',
    delete: 'Delete season',
    confirmDelete: (name: string, matches: number) =>
      matches === 0
        ? `Delete season “${name}”?`
        : `Delete season “${name}” with its ${matches === 1 ? '1 match' : `${matches} matches`}?`,
    notFound: 'This season was not found.',
    backToTeam: 'Back to the team',
  },
  errors: {
    required: 'This field is required.',
    tooLong: 'This is too long.',
    duplicateSeason: 'This team already has a season with this name.',
    duplicateOpponent: 'This season already has an opponent with this name.',
    invalidDate: 'Enter a valid date as YYYY-MM-DD.',
    endBeforeStart: 'The end date is before the start date.',
  },
  screen: {
    edit: 'Edit',
    editLabel: (name: string) => `Edit season ${name}`,
    tabs: 'Season sections',
    matches: 'Matches',
    opponents: 'Opponents',
    stats: 'Stats',
  },
  matches: {
    empty: 'No matches in this season yet.',
    emptyFor: (opponent: string) => `No matches against ${opponent} yet.`,
    filter: (opponent: string) => `vs ${opponent} ✕`,
    filterLabel: (opponent: string) => `vs ${opponent} ✕, remove the opponent filter`,
  },
  opponents: {
    empty: 'No opponents yet. Add the teams you play against, or create a match.',
    name: 'Opponent name',
    namePlaceholder: 'Team name',
    add: 'Add',
    addLabel: 'Add opponent',
    record: (won: number, lost: number) => `${won}–${lost}`,
    played: (n: number) => `${n} played`,
    upcoming: (n: number) => `${n} upcoming`,
    inProgress: (n: number) => `${n} in progress`,
    sets: (won: number, lost: number) => `sets ${won}:${lost}`,
    open: (name: string) => `${name}, show matches`,
    rename: 'Rename',
    renameLabel: (name: string) => `Rename opponent ${name}`,
    delete: 'Delete',
    deleteLabel: (name: string) => `Delete opponent ${name}`,
    deleteBlocked: 'Opponents with matches can’t be deleted.',
    confirmDelete: (name: string) => `Delete opponent “${name}”?`,
    newName: (name: string) => `New name for ${name}`,
  },
  stats: {
    empty:
      'No match played in this season yet. Stats appear once rallies are recorded in live mode.',
  },
} as const;
