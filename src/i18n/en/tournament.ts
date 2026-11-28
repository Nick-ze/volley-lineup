/** v12.0: hosted tournaments (the Tournaments tab, a tournament's table / matches / teams, results). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const tournament = {
  nav: {
    tournaments: 'Tournaments',
    newTournament: 'New tournament',
    editTournament: 'Edit tournament',
    tournament: 'Tournament',
    team: 'Team',
    result: 'Result',
  },
  tab: { label: 'Tournaments', accessibilityLabel: 'Tournaments tab' },
  /** `+24`, `−31` (a real minus sign) or `0`. */
  signed: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'),
  /** Between the parts of a quiet line (date · place · format). */
  metaSeparator: ' · ',
  /** The format in a quiet line: "best of 3", "2 sets". */
  format: {
    bestOf: (sets: number) => `best of ${sets}`,
    allSets: (sets: number) => plural(sets, 'set', 'sets'),
  },
  list: {
    new: 'New tournament',
    empty: 'No tournaments yet. Host one: enter its teams and results, the app keeps the table.',
    teamCount: (teams: number) => plural(teams, 'team', 'teams'),
    /** "6 teams · 9 of 15 played" from its two parts. */
    summary: (teams: string, played: string) => `${teams} · ${played}`,
    /** The first part when the two are drawn apart (they may wrap): "6 teams ·". */
    summaryLead: (teams: string) => `${teams} ·`,
    open: (name: string, summary: string) => `${name}, ${summary}. Open`,
    edit: 'Edit',
    editLabel: (name: string) => `Edit tournament ${name}`,
    delete: 'Delete',
    deleteLabel: (name: string) => `Delete tournament ${name}`,
    confirmDelete: (name: string, teams: number, results: number) =>
      teams === 0
        ? `Delete tournament “${name}”?`
        : `Delete tournament “${name}” with its ${plural(teams, 'team', 'teams')} and ${plural(results, 'result', 'results')}?`,
    ownTeamHint:
      'A tournament your own team plays in, with lineups and live scoring, is created in the team’s Matches tab.',
  },
  form: {
    name: 'Name',
    namePlaceholder: 'e.g. Winter Cup',
    date: 'Date (optional)',
    datePlaceholder: 'dd.mm.yy',
    location: 'Place (optional)',
    setsPerMatch: 'Sets per match',
    setsOptionLabel: (sets: number) => `${sets}, ${plural(sets, 'set', 'sets')} per match`,
    matchEnd: 'A match ends',
    bestOf: (sets: number) => `Best of ${sets}`,
    allSets: 'All sets are played',
    onlyAllSets: (sets: number) => `With ${sets} sets, all sets are always played.`,
    /** v12.1: who makes the plan. */
    plan: 'The matches',
    planOption: {
      roundRobin: 'Everyone plays everyone once',
      manual: 'I enter the matches myself',
    },
    planHint: {
      roundRobin: 'The app makes the plan from the teams.',
      manual: 'You add each match on the Matches tab. Two teams can meet more than once.',
    },
    planLocked: 'This can only be changed while the tournament has no results and no matches.',
    counts: {
      matches: 'The table counts matches: 2 points for a win.',
      sets: 'The table counts sets: 1 point per set won. A match can end in a draw.',
    },
    create: 'Create',
    notFound: 'This tournament was not found.',
    back: 'Back to the tournaments',
    blocked: {
      TOO_MANY_SETS: (teamA: string, teamB: string, sets: number) =>
        `${teamA} – ${teamB} has a result with ${plural(sets, 'set', 'sets')}. Change that result first.`,
      SET_AFTER_DECIDED: (teamA: string, teamB: string) =>
        `With “best of”, ${teamA} – ${teamB} would have a set after the deciding one. Change that result first.`,
      INVALID_SET: (teamA: string, teamB: string) =>
        `The result of ${teamA} – ${teamB} doesn’t fit these settings. Change that result first.`,
    },
  },
  errors: {
    required: 'This field is required.',
    tooLong: 'This is too long.',
    duplicateTournament: 'You already have a tournament with this name.',
    invalidDate: 'Enter a valid date as dd.mm.yy.',
    duplicateTeam: 'This tournament already has a team with this name.',
    tooManyTeams: (max: number) => `A tournament has at most ${max} teams.`,
  },
  screen: {
    edit: 'Edit',
    editLabel: (name: string) => `Edit tournament ${name}`,
    tabs: 'Tournament sections',
    table: 'Table',
    matches: 'Matches',
    teams: 'Teams',
  },
  teams: {
    name: 'Team name',
    namePlaceholder: 'Team name',
    add: 'Add',
    addLabel: 'Add team',
    count: (n: number, max: number) => `${n} of ${max} teams`,
    hint: 'Adding or removing a team changes the plan; results stay.',
    hintManual:
      'You add the matches yourself on the Matches tab. Removing a team deletes its matches.',
    empty: 'No teams yet. Add the teams that play in this tournament.',
    open: (name: string) => `${name}, show matches`,
    rename: 'Rename',
    renameLabel: (name: string) => `Rename team ${name}`,
    newName: (name: string) => `New name for ${name}`,
    delete: 'Delete',
    deleteLabel: (name: string) => `Delete team ${name}`,
    confirmDelete: (name: string, results: number) =>
      results === 0
        ? `Remove “${name}” from the tournament?`
        : `Remove “${name}” from the tournament? ${results === 1 ? 'Its 1 result is' : `Its ${results} results are`} deleted with it.`,
    confirmDeleteManual: (name: string, matches: number) =>
      matches === 0
        ? `Remove “${name}” from the tournament?`
        : `Remove “${name}” from the tournament? ${matches === 1 ? 'Its 1 match is' : `Its ${matches} matches are`} deleted with it.`,
  },
  matches: {
    played: (played: number, total: number) => `${played} of ${total} played`,
    round: (n: number) => `Round ${n}`,
    /** v12.1, a tournament with own matches: the match's number, and adding one. */
    match: (n: number) => `Match ${n}`,
    add: 'Add match',
    choose: 'Choose two teams',
    chosen: (teamA: string, teamB: string) => `${teamA} – ${teamB}`,
    emptyManual: 'No matches yet. Choose two teams above and tap “Add match”.',
    emptyManualTeams: 'Add at least two teams, then add the matches here.',
    tooMany: (max: number) => `A tournament has at most ${max} matches.`,
    resting: (name: string) => `${name} rests`,
    empty: 'Add at least two teams to see the plan.',
    /** Shown instead of scores for a match without a result. */
    open: '–',
    setsWon: 'Sets',
    /** Accessible name of a match row. */
    label: {
      open: (teamA: string, teamB: string) => `${teamA} – ${teamB}, not played yet. Enter result`,
      result: (teamA: string, teamB: string, setsA: number, setsB: number, sets: string) =>
        `${teamA} – ${teamB}, ${setsA}:${setsB} (${sets}). Change result`,
      /** v12.2: a set is being scored live. */
      live: (
        teamA: string,
        teamB: string,
        setsA: number,
        setsB: number,
        set: number,
        score: string,
      ) => `${teamA} – ${teamB}, ${setsA}:${setsB}, set ${set} running ${score}. Open result`,
      running: (teamA: string, teamB: string, setsA: number, setsB: number, sets: string) =>
        `${teamA} – ${teamB}, ${setsA}:${setsB} (${sets}), not finished. Change result`,
    },
  },
  table: {
    empty: 'Add at least two teams to see the table.',
    played: (n: number) => `${n} played`,
    record: (won: number, lost: number) => `${won}–${lost}`,
    recordWithDraws: (won: number, drawn: number, lost: number) => `${won}–${drawn}–${lost}`,
    sets: (won: number, lost: number) => `sets ${won}:${lost}`,
    /** A part of the row's line that another one follows: "4 played ·". */
    partLead: (part: string) => `${part} ·`,
    balls: (difference: string) => `balls ${difference}`,
    /** The label under the table points. */
    unit: { matches: 'Matches', sets: 'Sets' },
    rowLabel: (rank: number, name: string, line: string, points: number, unit: string) =>
      `${rank}. ${name}, ${line}, ${points} ${unit}. Show matches`,
    explain: {
      matches:
        'Counts matches: 2 for a win. Then set difference, ball difference, balls scored. Equal teams share a rank.',
      sets: 'Counts sets: 1 per set won. Then set difference, ball difference, balls scored. Equal teams share a rank.',
    },
  },
  team: {
    notFound: 'This team was not found.',
    back: 'Back to the tournament',
    rank: 'Rank',
    played: 'Played',
    record: 'Record',
    sets: 'Sets',
    balls: 'Balls',
    points: 'Points',
    setsValue: (won: number, lost: number) => `${won}:${lost}`,
    empty: 'No matches yet: this is the only team.',
    summaryLabel: (
      rank: number,
      played: number,
      record: string,
      sets: string,
      balls: string,
      points: number,
      unit: string,
    ) =>
      `Rank ${rank}, ${played} played, record ${record}, sets ${sets}, balls ${balls}, ${points} ${unit}`,
  },
  /** v12.2: a team's optional players. */
  players: {
    title: 'Players',
    hint: 'Optional. With players, live scoring can say who scored; without, the team is scored as a team.',
    shownBy: 'Players are shown by',
    label: { number: 'Number', name: 'Name' },
    labelOption: {
      number: 'Number: players are shown by their number',
      name: 'Name: players are shown by their name',
    },
    number: 'Number',
    numberPlaceholder: 'No.',
    name: 'Name',
    namePlaceholder: 'Player name',
    add: 'Add',
    addLabel: 'Add player',
    count: (n: number, max: number) => `${n} of ${max} players`,
    empty: 'No players yet.',
    /** A jersey number as shown: "#6". */
    numberText: (n: number) => `#${n}`,
    editLabel: (player: string) => `Edit player ${player}`,
    deleteLabel: (player: string) => `Delete player ${player}`,
    confirmDelete: (player: string) => `Delete player ${player}?`,
    editNumber: (player: string) => `Number of ${player}`,
    editName: (player: string) => `Name of ${player}`,
    errors: {
      REQUIRED: 'Enter a number or a name.',
      INVALID_NUMBER: 'Enter a whole number from 0 to 999.',
      DUPLICATE_NUMBER: 'This team already has a player with this number.',
      TOO_LONG: 'This is too long.',
      TOO_MANY: (max: number) => `A team has at most ${max} players.`,
    },
  },
  /** v12.2: live scoring of a tournament match (only the score, with optional point details). */
  live: {
    title: 'Live',
    open: 'Live',
    openLabel: 'Live: score this match point by point',
    set: (n: number) => `Set ${n}`,
    sets: (a: number, b: number) => `Sets ${a}:${b}`,
    colon: ':',
    scoreLabel: (set: number, teamA: string, a: number, teamB: string, b: number) =>
      `Set ${set}: ${teamA} ${a}, ${teamB} ${b}`,
    point: 'Point',
    pointLabel: (team: string) => `Point ${team}`,
    undo: 'Undo',
    undoLabel: 'Undo the last point',
    undoSetLabel: (set: number) => `Undo: play set ${set} on`,
    endSet: (set: number) => `End set ${set}`,
    endSetHint: 'A set can end when the two scores differ.',
    between: (set: number, a: number, b: number) => `Set ${set} ended ${a}:${b}.`,
    nextSet: (set: number) => `The next point starts set ${set}.`,
    over: {
      win: (team: string, a: number, b: number) => `${team} wins ${a}:${b}`,
      draw: (a: number, b: number) => `Draw ${a}:${b}`,
    },
    done: 'Done',
    tag: {
      label: 'Optional: how was the point won?',
      kinds: { attack: 'Attack', ace: 'Ace', block: 'Block', error: 'Opponent’s error' },
      kindLabel: (kind: string, team: string) => `${kind}: how ${team} won the point`,
      clearKindLabel: (kind: string) => `${kind}: remove this detail`,
      who: (kind: string, team: string) => `Optional: who? (${kind}, ${team})`,
      errorWho: (team: string) => `Optional: whose error? (${team})`,
      playerLabel: (player: string, full: string) => `${player}: ${full}`,
      close: '✕',
      closeLabel: '✕, close the point details',
    },
    stats: {
      title: 'Point details',
      none: 'No point details yet. After a point you can say how it was won.',
      attack: (n: number) => plural(n, 'attack point', 'attack points'),
      ace: (n: number) => plural(n, 'ace', 'aces'),
      block: (n: number) => plural(n, 'block', 'blocks'),
      error: (n: number) => plural(n, 'error', 'errors'),
      teamLabel: (team: string, line: string) => `${team}: ${line}`,
      playerLine: (player: string, line: string) => `${player}: ${line}`,
    },
    locked:
      'This match was scored live. To change the sets by hand, delete the live details first.',
    deleteLive: 'Delete live details',
    confirmDeleteLive: 'Delete the point-by-point details of this match? The set scores stay.',
    notFound: 'This match was not found.',
  },
  result: {
    title: 'Result',
    /** `label` is "Round 3" or (own matches) "Match 3". */
    subtitle: (tournament: string, label: string, format: string) =>
      `${tournament} · ${label} · ${format}`,
    set: (n: number) => `Set ${n}`,
    /** Between the two scores of a set. */
    colon: ':',
    scoreLabel: (set: number, team: string) => `Set ${set}, ${team}`,
    scoreboardLabel: (teamA: string, setsA: number, teamB: string, setsB: number) =>
      `${teamA} ${setsA}, ${teamB} ${setsB}`,
    hint: 'Two numbers that differ. Any set length.',
    delete: 'Delete result',
    confirmDelete: (teamA: string, teamB: string) => `Delete the result of ${teamA} – ${teamB}?`,
    deleteMatch: 'Delete match',
    confirmDeleteMatch: (teamA: string, teamB: string) => `Delete the match ${teamA} – ${teamB}?`,
    errors: {
      EQUAL: 'The two scores must differ.',
      RANGE: 'Enter whole numbers from 0 to 99.',
      INCOMPLETE: 'Enter both scores.',
      EMPTY: 'Enter at least one set.',
      TOO_MANY_SETS: 'This match has too many sets.',
      INVALID_SET: 'A set is not valid.',
      SET_AFTER_DECIDED: 'The match was already decided before the last set.',
    },
    notFound: 'This match was not found.',
  },
  /** v12.3: the table and the results as a printable page / PDF (the Table tab's button). */
  sheet: {
    button: 'Table (PDF)',
    buttonLabel: 'Table (PDF): print the table and all results, or save them as a PDF',
    dialogTitle: 'Share table',
    documentTitle: (tournament: string) => `Table · ${tournament}`,
    /** Above the tournament's name: once every match is played, and before. */
    finalTitle: 'Final table',
    interimTitle: 'Table',
    progress: (played: number, total: number) => `${played} of ${total} matches played`,
    rank: 'Rank',
    team: 'Team',
    played: 'Played',
    /** Column headers of the record: won–lost, won–drawn–lost. */
    record: 'W–L',
    recordWithDraws: 'W–D–L',
    sets: 'Sets',
    balls: 'Balls',
    points: 'Points',
    score: (a: number, b: number) => `${a}:${b}`,
    results: 'Results',
    versus: ' – ',
    notPlayed: 'not played yet',
    notFinished: '(not finished)',
  },
} as const;
