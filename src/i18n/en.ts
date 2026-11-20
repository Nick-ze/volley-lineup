/**
 * All user-facing strings. Shared strings live here; each feature keeps its strings in
 * `./en/<feature>.ts` (so parallel work doesn't conflict) and they are merged below.
 * Keep keys nested per screen/feature so a German file can mirror the shape later.
 */
import { lineup } from './en/lineup';
import { roster } from './en/roster';
import { rotation } from './en/rotation';
import { transfer } from './en/transfer';

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
    confirm: 'Confirm',
    rename: 'Rename',
    empty: 'Nothing here yet',
    notFound: 'Not found',
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
  },
  placeholder: {
    comingSoon: 'This screen is coming soon.',
  },
  roster,
  lineup,
  rotation,
  transfer,
} as const;

export type Strings = typeof en;
export const t = en;
