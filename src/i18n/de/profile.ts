import type { Strings } from '../en';

/** Tab-Leiste und Profil-Tab (bearbeiten, wechseln, abmelden, löschen). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const profile: Strings['profile'] = {
  tabs: {
    teams: 'Teams',
    profile: 'Profil',
    settings: 'Einstellungen',
    teamsLabel: 'Teams-Tab',
    profileLabel: 'Profil-Tab',
    settingsLabel: 'Einstellungen-Tab',
  },
  current: 'Angemeldet als',
  counts: (teams: number, players: number) =>
    `${plural(teams, 'Team', 'Teams')} · ${plural(players, 'Spieler', 'Spieler')}`,
  edit: 'Profil bearbeiten',
  editLabel: (name: string) => `Profil bearbeiten: ${name}`,
  account: 'Konto',
  logoutHint: 'Melde dich ab, um zur Profilliste zurückzukehren und ein anderes Profil zu öffnen.',
  logout: 'Abmelden',
  logoutNote: 'Deine Daten bleiben auf diesem Gerät.',
  dangerTitle: 'Profil löschen',
  dangerHint: 'Löscht dieses Profil mit allen Teams, Spielern und Spielen.',
  delete: 'Profil löschen',
  deleteLabel: (name: string) => `Profil löschen: ${name}`,
};
