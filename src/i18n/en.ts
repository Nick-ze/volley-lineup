/**
 * All user-facing strings. Shared strings live here; each feature keeps its strings in
 * `./en/<feature>.ts` (so parallel work doesn't conflict) and they are merged below.
 * German mirrors this shape in `./de.ts` + `./de/<feature>.ts`; components read strings via `useT()`.
 */
import { language } from './en/language';
import { lineup } from './en/lineup';
import { live } from './en/live';
import { match } from './en/match';
import { presets } from './en/presets';
import { print } from './en/print';
import { profile } from './en/profile';
import { roles } from './en/roles';
import { roster } from './en/roster';
import { stats } from './en/stats';
import { tags } from './en/tags';
import { rotation } from './en/rotation';
import { transfer } from './en/transfer';
import type { Widen } from './types';

export const en = {
  app: {
    name: 'Volley Lineup',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    back: 'Back',
    backWithChevron: '‹ Back',
    confirm: 'Confirm',
    rename: 'Rename',
    empty: 'Nothing here yet',
    notFound: 'Not found',
    pageNotFound: 'This page does not exist.',
    goHome: 'Go to start',
    loading: 'Loading',
  },
  nav: {
    profiles: 'Profiles',
    teams: 'Teams',
    team: 'Team',
    player: 'Player',
    match: 'Match',
    newMatch: 'New match',
    lineup: 'Lineup',
    rotation: 'Rotation',
    starters: 'Starters',
    preset: 'Preset',
    teamStarters: 'Team starters',
    live: 'Live',
    matchStats: 'Match stats',
    settings: 'Settings',
  },
  positions: {
    S: 'Setter',
    OH: 'Outside Hitter',
    MB: 'Middle Blocker',
    OPP: 'Opposite',
    L: 'Libero',
    DS: 'Defensive Specialist',
  },
  court: {
    position: (n: number) => `Position ${n}`,
    emptySlot: (n: number) => `Empty position ${n}`,
    net: 'Net',
    libero: 'Libero',
    server: 'Server',
  },
  player: {
    chipLabel: (number: number, name: string, position: string) =>
      `Number ${number}, ${name}, ${position}`,
    numberTag: (number: number) => `#${number}`,
  },
  placeholder: {
    comingSoon: 'This screen is coming soon.',
  },
  roster,
  lineup,
  rotation,
  transfer,
  print,
  live,
  language,
  profile,
  presets,
  match,
  stats,
  tags,
  roles,
} as const;

/** The shape every language must have (see `./types.ts`). German is typed with it in `./de.ts`. */
export type Strings = Widen<typeof en>;

/**
 * Static English strings, for tests and non-UI code. Components use `useT()` from `@/i18n`
 * instead, which follows the language setting (enforced by ESLint).
 */
export const t = en;
