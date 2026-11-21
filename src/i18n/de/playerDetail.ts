import type { Strings } from '../en';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** v6: Spielerseite und vertrauliche Beschreibungen. */
export const playerDetail: Strings['playerDetail'] = {
  title: 'Spieler',
  edit: 'Bearbeiten',
  editLabel: (name: string) => `Bearbeiten: ${name}`,
  number: (n: number) => `#${n}`,
  headerLabel: (number: number, name: string, positions: string, status: string) =>
    `Nummer ${number}, ${name}, ${positions}, ${status}`,
  signed: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'),
  season: {
    heading: 'Saison',
    empty:
      'Noch keine Sätze gespielt. Die Statistik erscheint, sobald dieser Spieler im Live-Modus auf dem Feld steht.',
    setsStarted: 'Sätze in der Startsechs',
    setsPlayed: 'Gespielte Sätze',
    rallies: 'Ballwechsel auf dem Feld',
    ralliesValue: (on: number, all: number) => `${on} von ${all}`,
    ralliesLabel: (on: number, all: number) =>
      `Ballwechsel auf dem Feld: ${on} von ${all} Ballwechseln`,
    plusMinus: '+/−',
    plusMinusLabel: (won: number, lost: number, value: string) =>
      `Plus/Minus auf dem Feld: ${value} (${won} gewonnen, ${lost} verloren)`,
    subIn: 'Eingewechselt',
    subOut: 'Ausgewechselt',
    serveTurns: 'Aufschlagserien',
    serves: 'Aufschläge',
    servePoints: 'Punkte bei Aufschlag',
    kills: 'Angriffspunkte',
    aces: 'Asse',
    blocks: 'Blockpunkte',
    errors: 'Fehler',
    tileLabel: (label: string, value: string) => `${label}: ${value}`,
    breakdownHeading: 'Fehler nach Art',
    breakdownItem: (count: number, name: string) => `${count} × ${name}`,
  },
  matches: {
    heading: 'Spiele',
    vs: (opponent: string) => `gegen ${opponent}`,
    line: (s) =>
      `${plural(s.sets, 'Satz', 'Sätze')} · ${s.rallies}/${s.of} Ballw. · ${s.plusMinus} · ` +
      `Ang ${s.kills} · Ass ${s.aces} · Blo ${s.blocks} · Feh ${s.errors}`,
    lineLabel: (s) =>
      `${plural(s.sets, 'Satz', 'Sätze')} gespielt, ${s.rallies} von ${s.of} Ballwechseln auf dem Feld, ` +
      `Plus/Minus ${s.plusMinus}, ${s.kills} Angriffspunkte, ${s.aces} Asse, ${s.blocks} Blockpunkte, ` +
      `${s.errors} Fehler`,
    open: (opponent: string, date: string) =>
      `gegen ${opponent}, ${date}. Leistung in diesem Spiel öffnen`,
  },
  description: {
    heading: 'Beschreibung',
    hint: 'Vertrauliche Notizen zu diesem Spieler. Verborgen, bis du sie entsperrst.',
    show: 'Beschreibungen zeigen',
    showLabel: 'Beschreibungen zeigen (vertraulich, muss entsperrt werden)',
    lock: 'Sperren',
    lockLabel: 'Sperren: alle Beschreibungen wieder verbergen',
    unlockedNote: 'Die Beschreibungen bleiben sichtbar, bis du sie sperrst oder die App verlässt.',
    prompt: 'Vertrauliche Spielerbeschreibungen entsperren',
    failed: 'Nicht entsperrt. Die Beschreibungen bleiben verborgen.',
    field: 'Beschreibung',
    placeholder: 'Notizen nur für dich',
    count: (n: number, max: number) => `${n} / ${max}`,
    save: 'Beschreibung speichern',
    saved: 'Beschreibung gespeichert.',
    removed: 'Beschreibung entfernt.',
    confirmTitle: 'Vertrauliche Notizen',
    confirmBody: 'Diese Notizen sind vertraulich. Anzeigen?',
    confirm: 'Anzeigen',
    cancel: 'Abbrechen',
  },
};
