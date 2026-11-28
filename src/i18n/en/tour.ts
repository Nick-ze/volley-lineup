/** v9.0: the tutorial — the tour choice, the tip popups and every screen's tips. */
import type { TourPage } from '@/domain/types';

export const tour = {
  choice: {
    title: 'Welcome to Volley Lineup',
    titleAgain: 'Tutorial',
    intro: 'Want a short tour? Tips pop up on the screens as you go.',
    full: 'Full tour',
    fullHint: 'Every screen, briefly.',
    quick: 'Quick tour',
    quickHint: 'Profile → team → first match. On other screens we ask.',
    none: 'No tour',
    noneHint: 'No tips.',
    /** Starts with the option's visible name. */
    optionLabel: (name: string, hint: string) => `${name}: ${hint}`,
    current: (name: string) => `Now: ${name}`,
    chosen: 'chosen now',
    cancel: 'Cancel',
    cancelLabel: 'Cancel: keep the current tour',
  },
  popup: {
    back: 'Back',
    backLabel: 'Back: previous tip',
    next: 'Next',
    nextLabel: 'Next: next tip',
    done: 'Got it',
    doneLabel: 'Got it: close the tips',
    end: 'End tour',
    endLabel: 'End tour: no more tips (choose again in Profile)',
    stepOf: (n: number, total: number) => `Tip ${n} of ${total}`,
    quickDone: 'That’s the quick tour. More tips: Profile → Tutorial.',
  },
  offer: {
    title: (page: string) => `Quick tip for ${page}?`,
    show: 'Show me',
    showLabel: (page: string) => `Show me: tips for ${page}`,
    no: 'No thanks',
    noLabel: (page: string) => `No thanks: skip the tips for ${page}`,
  },
  profile: {
    title: 'Tutorial',
    hint: 'Choose a tour again to restart its tips, or end it.',
    button: 'Choose again',
    buttonLabel: 'Choose again: full, quick or no tour',
    notChosen: 'Not chosen yet',
  },
  /** Sample names drawn in the visual guides. */
  sample: {
    profile: 'Coach',
    team: 'My team',
    season: '2026/27',
    opponent: 'Lions',
    player: 'Anna',
    email: 'anna@example.com',
    inviteCode: 'ABCDE-FGHJK',
    tournament: 'Winter Cup',
    setScore: '25 : 22',
  },
  /** Screen names in the "Quick tip for …?" offer. */
  pages: {
    profiles: 'Profiles',
    teams: 'Teams',
    roster: 'Roster',
    playerForm: 'Add player',
    matches: 'Matches',
    seasonForm: 'New season',
    seasonMatches: 'Season',
    matchForm: 'New match',
    builder: 'Lineup',
    profile: 'Profile',
    settings: 'Settings',
    presets: 'Presets',
    starters: 'Starters',
    teamStats: 'Team stats',
    playerDetail: 'Player details',
    presetEditor: 'Preset editor',
    startersEditor: 'Starters editor',
    seasonOpponents: 'Opponents',
    seasonStats: 'Season stats',
    rotation: 'Rotations',
    matchStarters: 'Starters overview',
    live: 'Live scoring',
    performance: 'Performance',
    matchStats: 'Match stats',
    account: 'Cloud sync',
    signIn: 'Sign in',
    cloudTeams: 'Cloud teams',
    members: 'Members',
    join: 'Join a team',
    tournaments: 'Tournaments',
    tournamentForm: 'New tournament',
    tournamentTable: 'Tournament table',
    tournamentMatches: 'Tournament matches',
    tournamentTeams: 'Tournament teams',
    tournamentTeam: 'A team’s matches',
    tournamentResult: 'Result',
    tournamentLive: 'Tournament live scoring',
  } satisfies Record<TourPage, string>,
  steps: {
    profiles: {
      create: {
        title: 'Create your profile',
        text: 'Your profile holds your teams. Type your name and tap “Create profile” (“New profile” adds another).',
      },
      open: {
        title: 'Your profiles',
        text: 'Later, tap your profile here to open its teams. Other managers can have their own profile.',
      },
    },
    teams: {
      create: {
        title: 'Create a team',
        text: 'Tap “New team”, give it a name and create it.',
      },
      open: {
        title: 'Open the team',
        text: 'Tap the team to manage its players, matches and lineups.',
      },
    },
    roster: {
      add: {
        title: 'Add your players',
        text: 'Tap “Add player” for everyone on the team. A lineup needs at least 6. Once you have players, “Player list (PDF)” prints the numbers for the scorer.',
      },
      sections: {
        title: 'Team sections',
        text: 'The bar at the bottom switches between Roster, Matches, Presets, Starters and Stats. You can also swipe sideways.',
      },
    },
    playerForm: {
      name: {
        title: 'Name and number',
        text: 'Type the first name, last name and jersey number.',
      },
      positions: {
        title: 'Positions',
        text: 'Pick the positions the player plays. The first one is the main position. Turn on Team captain for your captain. Then save.',
      },
    },
    matches: {
      season: {
        title: 'Start a season',
        text: 'Matches belong to a season or tournament. Tap “New season / tournament” to create one.',
      },
      open: {
        title: 'Open the season',
        text: '“New season / tournament” opens it. Later, tap a season box to get back to its matches, opponents and stats.',
      },
    },
    seasonForm: {
      form: {
        title: 'Season or tournament',
        text: 'Give it a name and choose Season or Tournament. Dates and place are optional.',
      },
    },
    seasonMatches: {
      add: {
        title: 'Register a match',
        text: 'Tap “New match” to add a match against an opponent.',
      },
      tabs: {
        title: 'Opponents and stats',
        text: 'Swipe or use the tabs for the season’s opponents and stats.',
      },
    },
    matchForm: {
      form: {
        title: 'Opponent and date',
        text: 'Pick an opponent or type a new one, set the date and home or away, then create the match.',
      },
    },
    builder: {
      drag: {
        title: 'Put players on court',
        text: 'Drag players from the bench onto the court, or tap a player and then a position.',
      },
      libero: {
        title: 'Libero and formation',
        text: 'Put your libero in the libero slot. Choose 5-1 or 6-2 and rotate so the setter starts where you want.',
      },
      serve: {
        title: 'Who serves first',
        text: 'Choose who serves first. Each set has its own tab; tap Live to score the match, or Print / PDF for the lineup sheet or the scorer’s player list.',
      },
    },
    profile: {
      look: {
        title: 'Your profile',
        text: 'Edit your name and colour, choose dark or light, or turn on the dyslexia-friendly font.',
      },
      tutorial: {
        title: 'Tutorial',
        text: 'Choose a tour again here any time, or end it.',
      },
    },
    settings: {
      display: {
        title: 'Language and chips',
        text: 'Choose the language, and whether player chips show numbers or names.',
      },
      backup: {
        title: 'Back up your data',
        text: 'Your data is stored on this device (shared teams also in the cloud). Export saves it to a file; Import loads it again, also on another device.',
      },
    },
    presets: {
      saved: {
        title: 'Saved lineups',
        text: 'Presets are lineups you use often. In a match, “Apply preset…” fills a set with one.',
      },
    },
    starters: {
      starters: {
        title: 'Team starters',
        text: 'Set your usual starting six and libero once. Every new match starts with them in set 1. Partly filled is fine.',
      },
    },
    teamStats: {
      stats: {
        title: 'Team stats',
        text: 'Points won and lost per rotation and per player, over all matches or one season.',
      },
    },
    playerDetail: {
      detail: {
        title: 'Player details',
        text: 'Photo, matches and confidential notes (locked until you unlock them). Tap Edit to change name, number or positions.',
      },
    },
    presetEditor: {
      edit: {
        title: 'Edit the preset',
        text: 'Drag or tap players onto the court, like in a match. Changes are saved at once.',
      },
    },
    startersEditor: {
      edit: {
        title: 'Your starters',
        text: 'Place the usual starting six and libero. New matches start with this lineup.',
      },
    },
    seasonOpponents: {
      add: {
        title: 'Opponents',
        text: 'Add the teams you play against. Tap one to see your matches against them.',
      },
    },
    seasonStats: {
      stats: {
        title: 'Season stats',
        text: 'Results, rotations and players of this season only.',
      },
    },
    rotation: {
      rotations: {
        title: 'All 6 rotations',
        text: 'See where everyone stands in each rotation. Players move clockwise when your team wins the serve back.',
      },
    },
    matchStarters: {
      overview: {
        title: 'Every set at a glance',
        text: 'The starting lineups of all sets. Tap a set to see its rotations.',
      },
    },
    live: {
      score: {
        title: 'Score every rally',
        text: 'Tap Point us or Point them. When you win the serve back, the team rotates by itself.',
      },
      tags: {
        title: 'Undo and tags',
        text: 'Undo takes back the last point. Tagging a point (kill, ace, error …) is optional.',
      },
      subs: {
        title: 'Substitutions and sets',
        text: 'Tap Substitution to swap players (6 per set). After a set, start the next; the match ends with a summary.',
      },
    },
    performance: {
      overview: {
        title: 'Performance',
        text: 'Each player’s rallies, points, errors and rating, per set or for the match. Tap a player for more.',
      },
    },
    matchStats: {
      stats: {
        title: 'Match stats',
        text: 'Points per rotation and per player. Filter by set. Print the lineups from the match screen.',
      },
    },
    account: {
      sync: {
        title: 'Cloud sync',
        text: 'Signed in, your shared teams sync between your devices. Everything still works offline; “Sync now” syncs at once.',
      },
    },
    signIn: {
      code: {
        title: 'Sign in with a code',
        text: 'Type your email and tap “Send code”. Enter the 6-digit code from the email. No password needed.',
      },
    },
    cloudTeams: {
      choose: {
        title: 'Choose your teams',
        text: 'Tick the teams to upload from this device and the cloud teams to download. Nothing is uploaded unless you tick it.',
      },
    },
    members: {
      invite: {
        title: 'Invite your team',
        text: 'Managers create an invite code for a manager or a player and share it. Players can only view the team.',
      },
    },
    join: {
      code: {
        title: 'Join with a code',
        text: 'Type the invite code you got from a manager and tap “Join”. The team then appears in your team list.',
      },
    },
    tournaments: {
      create: {
        title: 'Host a tournament',
        text: 'Running a tournament? Tap “New tournament”, enter its teams and type in the results. The app keeps the plan and the table.',
      },
      open: {
        title: 'Your tournaments',
        text: 'Tap a tournament to open it. A tournament your own team plays in, with lineups and live scoring, belongs in the team’s Matches tab.',
      },
    },
    tournamentForm: {
      format: {
        title: 'Sets and how a match ends',
        text: 'Choose 1 to 5 sets per match and how a match ends: with “Best of” the table counts matches, with “All sets are played” it counts sets. You also choose whether the app makes the plan or you enter the matches yourself.',
      },
    },
    tournamentTable: {
      table: {
        title: 'The table',
        text: 'Teams are ranked by table points, then set difference, ball difference and balls scored. Tap a team to see all its matches.',
      },
    },
    tournamentMatches: {
      result: {
        title: 'The plan',
        text: 'The app makes the plan (everyone plays everyone once), or you add the matches yourself if you chose that. Tap a match to enter or change its result.',
      },
      tabs: {
        title: 'Table, matches, teams',
        text: 'Swipe sideways or tap the chips to switch between the table, the matches and the teams.',
      },
    },
    tournamentTeams: {
      add: {
        title: 'Enter the teams',
        text: 'Type a name and tap “Add”, for 2 to 16 teams. The plan follows the teams; results stay when you add or remove one.',
      },
    },
    tournamentTeam: {
      matches: {
        title: 'One team’s matches',
        text: 'The team’s rank and numbers, then how it played against each of the others. Tap a match to open its result.',
      },
    },
    tournamentLive: {
      score: {
        title: 'Score point by point',
        text: 'Tap the team that won the rally. “End set” closes a set when it is over, whatever its length; the next point starts the next set. “Undo” takes the last step back.',
      },
      details: {
        title: 'Point details',
        text: 'After a point you can say how it was won: attack, ace, block or the opponent’s error. If the team has players, you can also say who. All of it is optional.',
      },
    },
    tournamentResult: {
      sets: {
        title: 'Type in the sets',
        text: 'Enter the two scores of each set. The next set appears when it can be played. “Save” stores the result, and the table follows.',
      },
    },
  },
} as const;
