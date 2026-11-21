import type { Strings } from '../en';

/** Tab-Leiste und Profil-Tab (bearbeiten, wechseln, abmelden, löschen). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const profile: Strings['profile'] = {
  tabs: {
    teams: 'Teams',
    profile: 'Profil',
    settings: 'Einstellungen',
    teamsLabel: 'Tab Teams',
    profileLabel: 'Tab Profil',
    settingsLabel: 'Tab Einstellungen',
  },
  current: 'Angemeldet als',
  counts: (teams: number, players: number) =>
    `${plural(teams, 'Team', 'Teams')} · ${plural(players, 'Spieler', 'Spieler')}`,
  edit: 'Profil bearbeiten',
  editLabel: (name: string) => `Profil ${name} bearbeiten`,
  account: 'Konto',
  switch: 'Profil wechseln',
  switchHint: 'Ein anderes Profil auf diesem Gerät öffnen.',
  logout: 'Abmelden',
  logoutNote: 'Deine Daten bleiben auf diesem Gerät.',
  dangerTitle: 'Profil löschen',
  dangerHint: 'Löscht dieses Profil mit allen Teams, Spielern und Spielen.',
  delete: 'Profil löschen',
  deleteLabel: (name: string) => `Profil ${name} löschen`,
};
