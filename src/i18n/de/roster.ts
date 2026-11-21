import type { Strings } from '../en';

/** Profile, Teams, Kader, Spieleliste. */
export const roster: Strings['roster'] = {
  errors: {
    required: 'Dieses Feld ist erforderlich.',
    tooLong: 'Das ist zu lang.',
    notInteger: 'Gib eine ganze Zahl ein.',
    outOfRange: 'Verwende eine Zahl von 0 bis 99.',
    taken: 'Diese Nummer ist in diesem Team schon vergeben.',
    invalidDate: 'Gib ein gültiges Datum im Format JJJJ-MM-TT ein.',
    duplicate: 'Eine Position ist doppelt ausgewählt.',
  },
  confirm: {
    title: 'Bist du sicher?',
    deleteProfile: (name: string) =>
      `Profil „${name}“ löschen? Alle Teams, Spieler und Spiele darin werden ebenfalls gelöscht.`,
    deleteTeam: (name: string) => `Team „${name}“ mit allen Spielern und Spielen löschen?`,
    deletePlayer: (name: string) =>
      `Spieler „${name}“ löschen? Die Person wird aus allen Aufstellungen entfernt.`,
    deleteMatch: (name: string) => `Das Spiel gegen „${name}“ löschen?`,
  },
  rowChevron: '›',
  profiles: {
    heading: 'Wer ist Teammanager?',
    hint: 'Tippe auf ein Profil, um seine Teams zu öffnen.',
    empty: 'Noch keine Profile. Lege eines an, um loszulegen.',
    new: 'Neues Profil',
    name: 'Profilname',
    color: 'Farbe',
    colorOption: (n: number) => `Farbe ${n}`,
    select: (name: string) => `Profil ${name} öffnen`,
    rename: (name: string) => `Profil ${name} umbenennen`,
    delete: (name: string) => `Profil ${name} löschen`,
    create: 'Profil anlegen',
  },
  teams: {
    heading: (profile: string) => `Teams von ${profile}`,
    empty: 'Noch keine Teams.',
    new: 'Neues Team',
    name: 'Teamname',
    season: 'Saison (optional)',
    seasonPlaceholder: '2026/27',
    create: 'Team anlegen',
    open: (name: string) => `Team ${name} öffnen`,
    rename: (name: string) => `Team ${name} bearbeiten`,
    delete: (name: string) => `Team ${name} löschen`,
    switchProfile: 'Profil wechseln',
    settings: 'Einstellungen',
  },
  team: {
    title: (name: string, season?: string) => (season ? `${name} · ${season}` : name),
    tabs: 'Team-Bereiche',
    rosterTab: 'Kader',
    matchesTab: 'Spiele',
    playerCount: (n: number) => (n === 1 ? '1 Spieler' : `${n} Spieler`),
  },
  roster: {
    empty: 'Noch keine Spieler.',
    addPlayer: 'Spieler hinzufügen',
    active: 'Aktiv',
    inactive: 'Verletzt',
    toggleActive: (name: string, active: boolean) =>
      active
        ? `${name} ist aktiv. Als verletzt oder inaktiv markieren`
        : `${name} ist verletzt. Als aktiv markieren`,
    rowLabel: (number: number, name: string, positions: string, active: boolean) =>
      `Nummer ${number}, ${name}, ${positions}${active ? '' : ', verletzt oder inaktiv'}`,
  },
  player: {
    addTitle: 'Spieler hinzufügen',
    editTitle: 'Spieler bearbeiten',
    firstName: 'Vorname',
    lastName: 'Nachname',
    number: 'Trikotnummer',
    positions: 'Positionen',
    positionsHint: 'Die zuerst gewählte Position ist die Hauptposition.',
    primary: 'Haupt',
    makePrimary: (position: string) => `${position} zur Hauptposition machen`,
    activeLabel: 'Aktiv (nicht verletzt)',
    delete: 'Spieler löschen',
    notFound: 'Diesen Spieler gibt es nicht mehr.',
  },
  matches: {
    empty: 'Noch keine Spiele.',
    newMatch: 'Neues Spiel',
    home: 'Heim',
    away: 'Auswärts',
    vs: (opponent: string) => `gegen ${opponent}`,
    open: (opponent: string, date: string) => `Spiel gegen ${opponent} am ${date} öffnen`,
    delete: (opponent: string) => `Spiel gegen ${opponent} löschen`,
  },
  matchForm: {
    opponent: 'Gegner',
    date: 'Datum (JJJJ-MM-TT)',
    venue: 'Spielort',
    create: 'Spiel anlegen',
  },
  teamNotFound: 'Dieses Team gibt es nicht mehr.',
  backToTeams: 'Zurück zu den Teams',
  backToTeam: 'Zurück zum Team',
};
