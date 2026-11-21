/**
 * German strings. Same shape as `./en.ts`: typed as `Strings`, so TypeScript fails when a key
 * is missing. Feature strings live in `./de/<feature>.ts`, mirroring `./en/<feature>.ts`.
 */
import { language } from './de/language';
import { lineup } from './de/lineup';
import { live } from './de/live';
import { match } from './de/match';
import { presets } from './de/presets';
import { print } from './de/print';
import { profile } from './de/profile';
import { roster } from './de/roster';
import { stats } from './de/stats';
import { tags } from './de/tags';
import { rotation } from './de/rotation';
import { transfer } from './de/transfer';
import type { Strings } from './en';

export const de: Strings = {
  app: {
    name: 'Volley Lineup',
  },
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    add: 'Hinzufügen',
    back: 'Zurück',
    backWithChevron: '‹ Zurück',
    confirm: 'Bestätigen',
    rename: 'Umbenennen',
    empty: 'Hier ist noch nichts',
    notFound: 'Nicht gefunden',
    pageNotFound: 'Diese Seite gibt es nicht.',
    goHome: 'Zum Start',
    loading: 'Wird geladen',
  },
  nav: {
    profiles: 'Profile',
    teams: 'Teams',
    team: 'Team',
    player: 'Spieler',
    match: 'Spiel',
    newMatch: 'Neues Spiel',
    lineup: 'Aufstellung',
    rotation: 'Rotation',
    starters: 'Startaufstellung',
    preset: 'Vorlage',
    teamStarters: 'Startsechs',
    live: 'Live',
    matchStats: 'Spielstatistik',
    settings: 'Einstellungen',
  },
  positions: {
    S: 'Zuspieler',
    OH: 'Außenangreifer',
    MB: 'Mittelblocker',
    OPP: 'Diagonalangreifer',
    L: 'Libero',
    DS: 'Abwehrspezialist',
  },
  court: {
    position: (n: number) => `Position ${n}`,
    emptySlot: (n: number) => `Position ${n} frei`,
    net: 'Netz',
    libero: 'Libero',
    server: 'Aufschläger',
  },
  player: {
    chipLabel: (number: number, name: string, position: string) =>
      `Nummer ${number}, ${name}, ${position}`,
    numberTag: (number: number) => `#${number}`,
  },
  placeholder: {
    comingSoon: 'Diese Ansicht kommt bald.',
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
};
