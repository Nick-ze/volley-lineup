import type { ErrorCategory } from '@/domain/performance';

import type { Strings } from '../en';

import { tags } from './tags';

/** Plural von `tags.errorTypeNames` ("2 Angriffsfehler"). */
const errorTypePlurals: Record<ErrorCategory, string> = {
  serve: 'Aufschlagfehler',
  reception: 'Annahmefehler',
  attack: 'Angriffsfehler',
  block: 'Blockfehler',
  set: 'Zuspielfehler',
  netFault: 'Netz- / Regelfehler',
  other: 'sonstige Fehler',
  unspecified: 'Fehler ohne Angabe',
};

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const rallies = (n: number) => (n === 1 ? '1 Ballwechsel' : `${n} Ballwechsel`);

/** v6: Leistung pro Satz / Spiel. */
export const performance: Strings['performance'] = {
  title: 'Leistung',
  open: 'Leistung',
  openLabel: 'Leistung aller Spieler in diesem Spiel',
  heading: (opponent: string) => `Leistung gegen ${opponent}`,
  notFound: 'Dieses Spiel wurde nicht gefunden.',
  empty:
    'Noch kein Satz gespielt. Die Leistung erscheint, sobald Ballwechsel im Live-Modus erfasst werden.',
  filter: {
    label: 'Leistung anzeigen für',
    all: 'Alle Sätze',
    allLabel: 'Alle Sätze: Leistung im ganzen Spiel',
    set: (n: number) => `Satz ${n}`,
    setLabel: (n: number) => `Satz ${n}: Leistung in diesem Satz`,
  },
  playerRef: (number: number, name: string) => `#${number} ${name}`,
  signed,
  rallies,
  record: (won: number, lost: number) => `${won}–${lost} (${signed(won - lost)})`,
  recordLabel: (won: number, lost: number) =>
    `${won} gewonnen, ${lost} verloren auf dem Feld, Plus/Minus ${signed(won - lost)}`,
  actions: (k: number, a: number, b: number, e: number, net: number) =>
    `Ang ${k} · Ass ${a} · Blo ${b} · Feh ${e} · Netto ${signed(net)}`,
  actionsLabel: (k: number, a: number, b: number, e: number, net: number) =>
    `Angriffspunkte ${k}, Asse ${a}, Blockpunkte ${b}, Fehler ${e}, Nettopunkte ${signed(net)}`,
  rating: {
    positive: 'Positiv',
    even: 'Ausgeglichen',
    negative: 'Negativ',
    none: 'Keine Ballwechsel',
  },
  ratingSymbol: { positive: '▲', even: '●', negative: '▼', none: '–' },
  ratingLabel: (rating: string) => `Bewertung ${rating}`,
  rowLabel: (ref: string, parts: string) => `${ref}: ${parts}. Details anzeigen`,
  legendHeading: 'So liest du es',
  legendRating:
    '▲ Positiv / ● Ausgeglichen / ▼ Negativ: Angriffspunkte + Asse + Blockpunkte minus Fehler (Nettopunkte). Ohne markierte Punkte: gewonnene minus verlorene Ballwechsel auf dem Feld.',
  legendActions:
    'Ang = Angriffspunkte, Ass = Asse, Blo = Blockpunkte, Feh = Fehler, Netto = Ang + Ass + Blo − Feh.',
  back: '‹ Alle Spieler',
  backLabel: 'Alle Spieler: zurück zur Übersicht',
  onCourt: 'Auf dem Feld',
  ralliesOf: (n: number, total: number) => `${n} von ${rallies(total)}`,
  wonLost: 'Gewonnen – verloren',
  wonLostValue: (won: number, lost: number) =>
    `${won} gewonnen, ${lost} verloren (${signed(won - lost)})`,
  errorRate: 'Fehlerquote',
  errorRateHint: 'Fehler pro Ballwechsel auf dem Feld.',
  errorRateValue: (pct: string, errors: number, onCourt: number) =>
    `${pct} (${errors} Fehler in ${rallies(onCourt)})`,
  errorsPerAction: 'Fehler pro Aktion',
  errorsPerActionHint:
    'Anteil der markierten Aktionen (Angriffspunkte, Asse, Blockpunkte, Fehler), die Fehler waren.',
  serveErrorRate: 'Aufschlag-Fehlerquote',
  serveErrorRateHint: 'Aufschlagfehler pro Aufschlag.',
  attackErrorRate: 'Angriffs-Fehlerquote',
  attackErrorRateHint:
    'Angriffsfehler pro Angriff, der den Ballwechsel beendet hat (Angriffspunkte + Angriffsfehler).',
  errorsByType: 'Fehler nach Art',
  noErrors: 'Keine Fehler',
  errorCount: (category: ErrorCategory, n: number) =>
    `${n} ${n === 1 ? tags.errorTypeNames[category] : errorTypePlurals[category]}`,
  kills: 'Angriffspunkte',
  aces: 'Asse',
  blocks: 'Blockpunkte',
  serves: 'Aufschläge',
  servePoints: 'Punkte bei Aufschlag',
  none: '–',
  percent: (n: number) => `${n} %`,
  lineLabel: (label: string, value: string) => `${label}: ${value}`,
};
