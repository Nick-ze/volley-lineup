import type { Strings } from '../en';

/** Rotationsansicht + Übersicht der Startaufstellungen. */
export const rotation: Strings['rotation'] = {
  title: (set: number) => `Rotation · Satz ${set}`,
  startersTitle: 'Startaufstellung',
  matchNotFound: 'Dieses Spiel wurde nicht gefunden.',
  noSets: 'Dieses Spiel hat noch keine Sätze.',
  emptySet: 'In diesem Satz sind noch keine Spieler. Stelle zuerst im Spiel die Aufstellung auf.',
  setterRotation: (n: number) => `Rotation ${n} (Zuspieler auf\u00a0${n})`,
  repeat: (time: number) => (time === 1 ? 'erstes Mal' : 'zweites Mal'),
  goToRotation: (n: number) => `Rotation ${n} zeigen`,
  previous: '‹ Vorige',
  next: 'Weiter ›',
  previousLabel: 'Vorige Rotation',
  nextLabel: 'Weiter: nächste Rotation',
  swipeHint: 'Wische auf dem Feld nach links oder rechts, um die Rotation zu wechseln.',
  setTab: (n: number) => `Satz ${n}`,
  setTabLabel: (n: number) => `Satz ${n} zeigen`,
  setPickerLabel: 'Sätze',
  stepperLabel: 'Rotationen',
  weServeFirst: 'Wir schlagen zuerst auf',
  weReceiveFirst: 'Wir nehmen zuerst an',
  libero: 'Libero',
  noLibero: 'Kein Libero',
  server: 'Aufschläger',
  frontRow: 'Vorderreihe',
  backRow: 'Hinterreihe',
  emptyGlyph: '–',
  unknownGlyph: '?',
  spotLabel: (position: number, row: string, player: string, isServer: boolean) =>
    `Position ${position}, ${row}: ${player}${isServer ? ', Aufschläger' : ''}`,
  /** v6: an empty spot still has its role from the formation (`role` is the role's name). */
  emptySpotLabel: (position: number, row: string, role: string | null = null) =>
    `Position ${position}, ${row}: frei${role ? ` (${role})` : ''}`,
  unknownPlayer: 'Unbekannter Spieler',
  cardLabel: (set: number, starters: string, libero: string, serve: string) =>
    `Satz ${set}: Rotationsansicht öffnen. Startspieler: ${starters}. Libero: ${libero}. ${serve}.`,
  starterSummary: (position: number, player: string) => `Position ${position} ${player}`,
  emptySummary: 'frei',
  playerSummary: (number: number, name: string) => `Nummer ${number} ${name}`,
  showLiberoSwaps: 'Libero-Wechsel zeigen',
  noLiberoReplaces:
    'Wähle in der Aufstellung, wen der Libero ersetzt, um die Libero-Wechsel zu sehen.',
  liberoOff: 'Libero ist in diesem Satz ausgeschaltet',
  liberoFor: (number: number | null) => (number === null ? 'L' : `L für #${number}`),
  liberoForLabel: (player: string, replaced: string) => `Libero ${player}, für ${replaced}`,
  openRotationHint: 'Zeigt die Rotationen 1 bis 6 für diesen Satz',
};
