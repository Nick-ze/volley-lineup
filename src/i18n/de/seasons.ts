import type { Strings } from '../en';

/** v7.0: Saisons / Turniere, Gegner und Statistik. */
export const seasons: Strings['seasons'] = {
  title: 'Saison',
  kind: { season: 'Saison', tournament: 'Turnier' },
  list: {
    empty: 'Noch keine Saison. Leg eine Saison oder ein Turnier an, um Spiele hinzuzufügen.',
    newSeason: 'Neue Saison / Turnier',
    matchCount: (n: number) => (n === 1 ? '1 Spiel' : `${n} Spiele`),
    record: (won: number, lost: number) => `${won}–${lost}`,
    open: (summary: string) => `${summary}. Öffnen`,
  },
  dates: (start?: string, end?: string) =>
    start && end ? `${start} – ${end}` : start ? `ab ${start}` : end ? `bis ${end}` : '',
  form: {
    newTitle: 'Neue Saison / Turnier',
    editTitle: 'Saison / Turnier bearbeiten',
    name: 'Name',
    namePlaceholder: 'z. B. 2026/27 oder Sommer-Cup',
    kind: 'Art',
    startDate: 'Beginn (optional)',
    endDate: 'Ende (optional)',
    datePlaceholder: 'JJJJ-MM-TT',
    location: 'Ort (optional)',
    create: 'Anlegen',
    delete: 'Löschen',
    confirmDelete: (name: string, matches: number) =>
      matches === 0
        ? `Saison „${name}“ löschen?`
        : `Saison „${name}“ mit ${matches === 1 ? 'ihrem 1 Spiel' : `ihren ${matches} Spielen`} löschen?`,
    notFound: 'Diese Saison wurde nicht gefunden.',
    backToTeam: 'Zurück zum Team',
  },
  errors: {
    required: 'Dieses Feld ist erforderlich.',
    tooLong: 'Das ist zu lang.',
    duplicateSeason: 'Dieses Team hat schon eine Saison mit diesem Namen.',
    duplicateOpponent: 'Diese Saison hat schon einen Gegner mit diesem Namen.',
    invalidDate: 'Gib ein gültiges Datum als JJJJ-MM-TT ein.',
    endBeforeStart: 'Das Ende liegt vor dem Beginn.',
  },
  screen: {
    edit: 'Bearbeiten',
    editLabel: (name: string) => `Bearbeiten: Saison ${name}`,
    tabs: 'Bereiche der Saison',
    matches: 'Spiele',
    opponents: 'Gegner',
    stats: 'Statistik',
  },
  matches: {
    empty: 'Noch keine Spiele in dieser Saison.',
    emptyFor: (opponent: string) => `Noch keine Spiele gegen ${opponent}.`,
    filter: (opponent: string) => `gegen ${opponent} ✕`,
    filterLabel: (opponent: string) => `gegen ${opponent} ✕, Gegnerfilter entfernen`,
  },
  opponents: {
    empty: 'Noch keine Gegner. Füg die Teams hinzu, gegen die du spielst, oder leg ein Spiel an.',
    name: 'Name des Gegners',
    namePlaceholder: 'Teamname',
    add: 'Hinzufügen',
    addLabel: 'Hinzufügen: Gegner',
    record: (won: number, lost: number) => `${won}–${lost}`,
    played: (n: number) => `${n} gespielt`,
    upcoming: (n: number) => `${n} geplant`,
    inProgress: (n: number) => `${n} laufend`,
    sets: (won: number, lost: number) => `Sätze ${won}:${lost}`,
    open: (name: string) => `${name}, Spiele zeigen`,
    rename: 'Umbenennen',
    renameLabel: (name: string) => `Umbenennen: Gegner ${name}`,
    delete: 'Löschen',
    deleteLabel: (name: string) => `Löschen: Gegner ${name}`,
    deleteBlocked: 'Gegner mit Spielen können nicht gelöscht werden.',
    confirmDelete: (name: string) => `Gegner „${name}“ löschen?`,
    newName: (name: string) => `Neuer Name für ${name}`,
  },
  stats: {
    empty:
      'In dieser Saison wurde noch kein Spiel gespielt. Die Statistik erscheint, sobald im Live-Modus Ballwechsel erfasst sind.',
  },
};
