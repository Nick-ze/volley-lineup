import type { Strings } from '../en';

/** Live-Modus + Wechsel. */
export const live: Strings['live'] = {
  title: (set: number) => `Live · Satz ${set}`,
  open: 'Live',
  openLabel: 'Live-Modus für diesen Satz öffnen',
  matchNotFound: 'Dieses Spiel wurde nicht gefunden.',
  noSet: 'Dieser Satz hat noch keine Aufstellung. Stelle sie zuerst im Spiel auf.',
  incomplete: 'Stelle sechs Spieler aufs Feld, bevor du den Live-Modus startest.',
  setLabel: (n: number) => `Satz ${n}`,
  us: 'Wir',
  them: (opponent: string) => opponent,
  scoreLabel: (set: number, us: number, them: number, opponent: string) =>
    `Satz ${set}, Spielstand: wir ${us}, ${opponent} ${them}`,
  serving: 'Aufschlag',
  weServe: (number: number | null) =>
    number === null ? 'Wir haben Aufschlag' : `Wir haben Aufschlag · #${number}`,
  theyServe: (opponent: string) => `${opponent} hat Aufschlag`,
  rotation: (n: number) => `Rotation ${n}`,
  pointUs: 'Punkt für uns',
  pointUsLabel: 'Wir haben den Ballwechsel gewonnen',
  pointThem: 'Punkt Gegner',
  pointThemLabel: (opponent: string) => `${opponent} hat den Ballwechsel gewonnen`,
  undo: 'Rückgängig',
  undoNothing: 'Nichts rückgängig zu machen',
  undoPoint: (us: boolean) =>
    us ? 'Letzten Punkt für uns zurücknehmen' : 'Letzten Punkt für den Gegner zurücknehmen',
  undoSub: (out: string, inn: string) => `Wechsel zurücknehmen: ${inn} für ${out}`,
  substitution: 'Wechsel',
  substitutionLabel: 'Einen Wechsel durchführen',
  cancelSub: 'Abbrechen',
  cancelSubLabel: 'Den Wechsel abbrechen',
  subsUsed: (n: number, max: number) => `Wechsel ${n}/${max}`,
  pickOut: 'Tippe den Spieler auf dem Feld an, der rausgeht.',
  pickIn: (out: string) => `Tippe jetzt den Bankspieler an, der für ${out} reinkommt.`,
  benchTitle: 'Bank',
  benchEmpty: 'Keine Spieler mehr auf der Bank.',
  courtPlayerLabel: (desc: string, position: number, isServer: boolean) =>
    `Position ${position}: ${desc}${isServer ? ', hat Aufschlag' : ''}`,
  courtPlayerHint: 'Tippen, um diesen Spieler auszuwechseln',
  benchPlayerHint: (out: string, warning: string | null) =>
    warning ? `Kommt für ${out}. Achtung: ${warning}` : `Kommt für ${out}`,
  previewWarning: {
    SUB_LIMIT: 'über dem Limit von 6 Wechseln',
    REENTRY_RULE: 'verstößt gegen die Rückwechsel-Regel',
    INVALID_SUB: 'nicht möglich',
  },
  emptySpot: (position: number) => `Position ${position}: frei`,
  playerRef: (number: number, name: string) => `#${number} ${name}`,
  unknownPlayer: '?',
  setPoint: (us: boolean, opponent: string) =>
    us ? 'Satzball für uns!' : `Satzball für ${opponent}`,
  setWon: (us: boolean, opponent: string) =>
    us
      ? 'Wir haben den Satz gewonnen. Beende ihn, wann du willst.'
      : `${opponent} hat den Satz gewonnen.`,
  warningsTitle: 'Hinweise zu Wechseln',
  warnSubLimit: (out: string, inn: string, max: number) =>
    `${inn} für ${out}: mehr als ${max} Wechsel in diesem Satz.`,
  warnReentry: (out: string, inn: string) =>
    `${inn} für ${out}: Ein Einwechselspieler darf nur gegen den Spieler zurückgewechselt werden, für den er kam, und jedes Paar nur einmal.`,
  warnInvalid: (out: string, inn: string) => `${inn} für ${out} war nicht möglich (übersprungen).`,
  libero: (ref: string | null) => (ref ? `Libero ${ref} (zählt nicht als Wechsel)` : 'Kein Libero'),
  reset: 'Live-Daten zurücksetzen',
  resetHint:
    'Löscht Spielstand und Wechsel dieses Satzes, damit die Aufstellung wieder bearbeitet werden kann',
  resetConfirm:
    'Spielstand und alle Wechsel dieses Satzes löschen? Danach kann die Aufstellung wieder bearbeitet werden.',
  resetConfirmButton: 'Zurücksetzen',
  lineupLocked: 'Dieser Satz wurde gespielt – setze die Live-Daten zurück, um ihn zu bearbeiten.',
};
