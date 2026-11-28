import type { Strings } from '../en';

/** v12.0: eigene Turniere (Tab „Turniere“, Tabelle / Spiele / Teams eines Turniers, Ergebnisse). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const tournament: Strings['tournament'] = {
  nav: {
    tournaments: 'Turniere',
    newTournament: 'Neues Turnier',
    editTournament: 'Turnier bearbeiten',
    tournament: 'Turnier',
    team: 'Team',
    result: 'Ergebnis',
  },
  tab: { label: 'Turniere', accessibilityLabel: 'Turniere-Tab' },
  signed: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'),
  metaSeparator: ' · ',
  format: {
    bestOf: (sets: number) => `Best of ${sets}`,
    allSets: (sets: number) => plural(sets, 'Satz', 'Sätze'),
  },
  list: {
    new: 'Neues Turnier',
    empty:
      'Noch keine Turniere. Richte eines aus: Trag Teams und Ergebnisse ein, die App führt die Tabelle.',
    teamCount: (teams: number) => plural(teams, 'Team', 'Teams'),
    summary: (teams: string, played: string) => `${teams} · ${played}`,
    summaryLead: (teams: string) => `${teams} ·`,
    open: (name: string, summary: string) => `${name}, ${summary}. Öffnen`,
    edit: 'Bearbeiten',
    editLabel: (name: string) => `Bearbeiten: Turnier ${name}`,
    delete: 'Löschen',
    deleteLabel: (name: string) => `Löschen: Turnier ${name}`,
    confirmDelete: (name: string, teams: number, results: number) =>
      teams === 0
        ? `Turnier „${name}“ löschen?`
        : `Turnier „${name}“ mit ${plural(teams, 'Team', 'Teams')} und ${plural(results, 'Ergebnis', 'Ergebnissen')} löschen?`,
    ownTeamHint:
      'Ein Turnier, bei dem dein eigenes Team mitspielt, mit Aufstellungen und Live-Modus, legst du im Tab „Spiele“ des Teams an.',
  },
  form: {
    name: 'Name',
    namePlaceholder: 'z. B. Winter-Cup',
    date: 'Datum (optional)',
    datePlaceholder: 'tt.mm.jj',
    location: 'Ort (optional)',
    setsPerMatch: 'Sätze pro Spiel',
    setsOptionLabel: (sets: number) => `${sets}, ${plural(sets, 'Satz', 'Sätze')} pro Spiel`,
    matchEnd: 'Ein Spiel endet',
    bestOf: (sets: number) => `Best of ${sets}`,
    allSets: 'Alle Sätze werden gespielt',
    onlyAllSets: (sets: number) => `Bei ${sets} Sätzen werden immer alle Sätze gespielt.`,
    counts: {
      matches: 'Die Tabelle zählt Spiele: 2 Punkte für einen Sieg.',
      sets: 'Die Tabelle zählt Sätze: 1 Punkt pro gewonnenem Satz. Ein Spiel kann unentschieden enden.',
    },
    create: 'Anlegen',
    notFound: 'Dieses Turnier wurde nicht gefunden.',
    back: 'Zurück zu den Turnieren',
    blocked: {
      TOO_MANY_SETS: (teamA: string, teamB: string, sets: number) =>
        `${teamA} – ${teamB} hat ein Ergebnis mit ${plural(sets, 'Satz', 'Sätzen')}. Ändere zuerst dieses Ergebnis.`,
      SET_AFTER_DECIDED: (teamA: string, teamB: string) =>
        `Mit „Best of“ hätte ${teamA} – ${teamB} einen Satz nach dem entscheidenden. Ändere zuerst dieses Ergebnis.`,
      INVALID_SET: (teamA: string, teamB: string) =>
        `Das Ergebnis von ${teamA} – ${teamB} passt nicht zu diesen Einstellungen. Ändere zuerst dieses Ergebnis.`,
    },
  },
  errors: {
    required: 'Dieses Feld ist erforderlich.',
    tooLong: 'Das ist zu lang.',
    duplicateTournament: 'Du hast schon ein Turnier mit diesem Namen.',
    invalidDate: 'Gib ein gültiges Datum als tt.mm.jj ein.',
    duplicateTeam: 'Dieses Turnier hat schon ein Team mit diesem Namen.',
    tooManyTeams: (max: number) => `Ein Turnier hat höchstens ${max} Teams.`,
  },
  screen: {
    edit: 'Bearbeiten',
    editLabel: (name: string) => `Bearbeiten: Turnier ${name}`,
    tabs: 'Bereiche des Turniers',
    table: 'Tabelle',
    matches: 'Spiele',
    teams: 'Teams',
  },
  teams: {
    name: 'Teamname',
    namePlaceholder: 'Teamname',
    add: 'Hinzufügen',
    addLabel: 'Hinzufügen: Team',
    count: (n: number, max: number) => `${n} von ${max} Teams`,
    hint: 'Ein neues oder entferntes Team ändert den Spielplan; Ergebnisse bleiben.',
    empty: 'Noch keine Teams. Füg die Teams hinzu, die in diesem Turnier spielen.',
    open: (name: string) => `${name}, Spiele anzeigen`,
    rename: 'Umbenennen',
    renameLabel: (name: string) => `Umbenennen: Team ${name}`,
    newName: (name: string) => `Neuer Name für ${name}`,
    delete: 'Löschen',
    deleteLabel: (name: string) => `Löschen: Team ${name}`,
    confirmDelete: (name: string, results: number) =>
      results === 0
        ? `„${name}“ aus dem Turnier entfernen?`
        : `„${name}“ aus dem Turnier entfernen? ${results === 1 ? 'Sein 1 Ergebnis wird' : `Seine ${results} Ergebnisse werden`} mitgelöscht.`,
  },
  matches: {
    played: (played: number, total: number) => `${played} von ${total} gespielt`,
    round: (n: number) => `Runde ${n}`,
    resting: (name: string) => `${name} spielfrei`,
    empty: 'Füg mindestens zwei Teams hinzu, um den Spielplan zu sehen.',
    open: '–',
    setsWon: 'Sätze',
    label: {
      open: (teamA: string, teamB: string) =>
        `${teamA} – ${teamB}, noch nicht gespielt. Ergebnis eintragen`,
      result: (teamA: string, teamB: string, setsA: number, setsB: number, sets: string) =>
        `${teamA} – ${teamB}, ${setsA}:${setsB} (${sets}). Ergebnis ändern`,
      running: (teamA: string, teamB: string, setsA: number, setsB: number, sets: string) =>
        `${teamA} – ${teamB}, ${setsA}:${setsB} (${sets}), noch nicht beendet. Ergebnis ändern`,
    },
  },
  table: {
    empty: 'Füg mindestens zwei Teams hinzu, um die Tabelle zu sehen.',
    played: (n: number) => `${n} gespielt`,
    record: (won: number, lost: number) => `${won}–${lost}`,
    recordWithDraws: (won: number, drawn: number, lost: number) => `${won}–${drawn}–${lost}`,
    sets: (won: number, lost: number) => `Sätze ${won}:${lost}`,
    partLead: (part: string) => `${part} ·`,
    balls: (difference: string) => `Bälle ${difference}`,
    unit: { matches: 'Spiele', sets: 'Sätze' },
    rowLabel: (rank: number, name: string, line: string, points: number, unit: string) =>
      `${rank}. ${name}, ${line}, ${points} ${unit}. Spiele anzeigen`,
    explain: {
      matches:
        'Zählt Spiele: 2 für einen Sieg. Danach Satzdifferenz, Balldifferenz, erzielte Bälle. Gleiche Teams teilen sich einen Rang.',
      sets: 'Zählt Sätze: 1 pro gewonnenem Satz. Danach Satzdifferenz, Balldifferenz, erzielte Bälle. Gleiche Teams teilen sich einen Rang.',
    },
  },
  team: {
    notFound: 'Dieses Team wurde nicht gefunden.',
    back: 'Zurück zum Turnier',
    rank: 'Rang',
    played: 'Gespielt',
    record: 'Bilanz',
    sets: 'Sätze',
    balls: 'Bälle',
    points: 'Punkte',
    setsValue: (won: number, lost: number) => `${won}:${lost}`,
    empty: 'Noch keine Spiele: Das ist das einzige Team.',
    summaryLabel: (
      rank: number,
      played: number,
      record: string,
      sets: string,
      balls: string,
      points: number,
      unit: string,
    ) =>
      `Rang ${rank}, ${played} gespielt, Bilanz ${record}, Sätze ${sets}, Bälle ${balls}, ${points} ${unit}`,
  },
  result: {
    title: 'Ergebnis',
    subtitle: (tournament: string, round: number, format: string) =>
      `${tournament} · Runde ${round} · ${format}`,
    set: (n: number) => `Satz ${n}`,
    colon: ':',
    scoreLabel: (set: number, team: string) => `Satz ${set}, ${team}`,
    scoreboardLabel: (teamA: string, setsA: number, teamB: string, setsB: number) =>
      `${teamA} ${setsA}, ${teamB} ${setsB}`,
    hint: 'Zwei verschiedene Zahlen. Jede Satzlänge.',
    delete: 'Ergebnis löschen',
    confirmDelete: (teamA: string, teamB: string) => `Ergebnis von ${teamA} – ${teamB} löschen?`,
    errors: {
      EQUAL: 'Die beiden Zahlen müssen verschieden sein.',
      RANGE: 'Gib ganze Zahlen von 0 bis 99 ein.',
      INCOMPLETE: 'Gib beide Zahlen ein.',
      EMPTY: 'Gib mindestens einen Satz ein.',
      TOO_MANY_SETS: 'Dieses Spiel hat zu viele Sätze.',
      INVALID_SET: 'Ein Satz ist nicht gültig.',
      SET_AFTER_DECIDED: 'Das Spiel war schon vor dem letzten Satz entschieden.',
    },
    notFound: 'Dieses Spiel wurde nicht gefunden.',
  },
};
