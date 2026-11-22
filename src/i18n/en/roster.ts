/** Strings for Worker A — profiles, teams, roster, matches list. */
export const roster = {
  errors: {
    required: 'This field is required.',
    tooLong: 'This is too long.',
    notInteger: 'Enter a whole number.',
    outOfRange: 'Use a number from 0 to 99.',
    taken: 'This number is already used in this team.',
    invalidDate: 'Enter a valid date as YYYY-MM-DD.',
    duplicate: 'A position is selected twice.',
  },
  confirm: {
    title: 'Are you sure?',
    deleteProfile: (name: string) =>
      `Delete profile "${name}"? All its teams, players and matches are deleted too.`,
    deleteTeam: (name: string) => `Delete team "${name}" with all its players and matches?`,
    deletePlayer: (name: string) => `Delete player "${name}"? They are removed from all lineups.`,
    deleteMatch: (name: string) => `Delete the match against "${name}"?`,
  },
  /** Decorative "opens" marker at the end of list rows. */
  rowChevron: '›',
  profiles: {
    heading: 'Who is managing?',
    hint: 'Tap a profile to open its teams.',
    empty: 'No profiles yet. Create one to get started.',
    new: 'New profile',
    name: 'Profile name',
    color: 'Colour',
    colorOption: (n: number) => `Colour ${n}`,
    select: (name: string) => `Open profile ${name}`,
    rename: (name: string) => `Edit profile ${name}`,
    delete: (name: string) => `Delete profile ${name}`,
    create: 'Create profile',
  },
  teams: {
    heading: (profile: string) => `${profile}'s teams`,
    empty: 'No teams yet.',
    new: 'New team',
    name: 'Team name',
    season: 'Season (optional)',
    seasonPlaceholder: '2026/27',
    create: 'Create team',
    open: (name: string) => `Open team ${name}`,
    rename: (name: string) => `Edit team ${name}`,
    delete: (name: string) => `Delete team ${name}`,
  },
  team: {
    title: (name: string, season?: string) => (season ? `${name} · ${season}` : name),
    tabs: 'Team sections',
    rosterTab: 'Roster',
    matchesTab: 'Matches',
    playerCount: (n: number) => (n === 1 ? '1 player' : `${n} players`),
  },
  roster: {
    empty: 'No players yet.',
    addPlayer: 'Add player',
    active: 'Active',
    inactive: 'Injured',
    toggleActive: (name: string, active: boolean) =>
      active
        ? `${name} is active. Mark as injured or inactive`
        : `${name} is injured. Mark as active`,
    rowLabel: (number: number, name: string, positions: string, active: boolean) =>
      `Number ${number}, ${name}, ${positions}${active ? '' : ', injured or inactive'}`,
  },
  player: {
    addTitle: 'Add player',
    editTitle: 'Edit player',
    firstName: 'First name',
    lastName: 'Last name',
    number: 'Jersey number',
    positions: 'Positions',
    positionsHint: 'The first selected position is the primary one.',
    primary: 'Primary',
    makePrimary: (position: string) => `Make ${position} the primary position`,
    activeLabel: 'Active (not injured)',
    delete: 'Delete player',
    notFound: 'This player no longer exists.',
    deleteBlocked:
      "This player appears in a played set (lineup, substitution or point details), so they can't be deleted. Mark them as injured instead, or reset that set's live data first.",
  },
  matches: {
    empty: 'No matches yet.',
    newMatch: 'New match',
    home: 'Home',
    away: 'Away',
    vs: (opponent: string) => `vs ${opponent}`,
    open: (opponent: string, date: string) => `vs ${opponent}, ${date}: open the match`,
    delete: (opponent: string) => `Delete match against ${opponent}`,
    /** v6.2: search field. */
    search: 'Search matches',
    searchPlaceholder: 'Opponent or date, e.g. 21.11.',
    noResults: (query: string) => `No matches for “${query}”.`,
    resultCount: (shown: number, total: number) => `${shown} of ${total} matches`,
  },
  matchForm: {
    opponent: 'Opponent',
    date: 'Date (YYYY-MM-DD)',
    venue: 'Venue',
    create: 'Create match',
    /** v7.0: the season / tournament the match goes into. */
    season: 'Season / tournament',
    seasonName: 'Season name',
    seasonNew: 'Your team has no season yet. It is created with this match.',
    /** v7.0: the season's opponents as chips, plus a field for a new one. */
    opponentChips: (season: string) => `Opponents in ${season}`,
    newOpponent: 'Or a new opponent',
    willAdd: (name: string, season: string) => `${name} is added to ${season}.`,
    existing: (name: string) => `${name} is already in this season.`,
  },
  /** v7.0: a season's name with its kind ("2026/27 · Season"). */
  seasonKind: { season: 'Season', tournament: 'Tournament' },
  seasonLine: (name: string, kind: string) => `${name} · ${kind}`,
  seasonLabel: (name: string, kind: string) => `${name}, ${kind}`,
  teamNotFound: 'This team no longer exists.',
  backToTeams: 'Back to teams',
  backToTeam: 'Back to team',
} as const;
