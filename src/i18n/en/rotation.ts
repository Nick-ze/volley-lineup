/** Strings for Worker B — rotation viewer + starters overview. */
export const rotation = {
  title: (set: number) => `Rotation · Set ${set}`,
  startersTitle: 'Starters',
  matchNotFound: 'This match could not be found.',
  noSets: 'This match has no sets yet.',
  emptySet: 'No players in this set yet. Build the lineup on the match screen first.',
  rotationOf: (n: number, total: number) => `Rotation ${n} of ${total}`,
  /** v4: the rotation is named after the setter's position. */
  setterRotation: (n: number) => `Rotation ${n} (setter at position ${n})`,
  goToRotation: (n: number) => `Show rotation ${n}`,
  previous: '‹ Previous',
  next: 'Next ›',
  previousLabel: 'Previous rotation',
  nextLabel: 'Next rotation',
  swipeHint: 'Swipe left or right on the court to change rotation.',
  setTab: (n: number) => `Set ${n}`,
  setTabLabel: (n: number) => `Show set ${n}`,
  setPickerLabel: 'Sets',
  stepperLabel: 'Rotations',
  weServeFirst: 'We serve first',
  weReceiveFirst: 'We receive first',
  libero: 'Libero',
  noLibero: 'No libero',
  server: 'Server',
  frontRow: 'Front row',
  backRow: 'Back row',
  emptyGlyph: '–',
  unknownGlyph: '?',
  spotLabel: (position: number, row: string, player: string, isServer: boolean) =>
    `Position ${position}, ${row}: ${player}${isServer ? ', server' : ''}`,
  emptySpotLabel: (position: number, row: string) => `Position ${position}, ${row}: empty`,
  unknownPlayer: 'Unknown player',
  /** Screen-reader summary of a starters card: what the card shows + what tapping does. */
  cardLabel: (set: number, starters: string, libero: string, serve: string) =>
    `Set ${set}: open rotation viewer. Starters: ${starters}. Libero: ${libero}. ${serve}.`,
  starterSummary: (position: number, player: string) => `position ${position} ${player}`,
  emptySummary: 'empty',
  playerSummary: (number: number, name: string) => `number ${number} ${name}`,
  openRotationHint: 'Shows rotations 1 to 6 for this set',
  showLiberoSwaps: 'Show libero swaps',
  noLiberoReplaces: 'Choose whom the libero replaces in the lineup builder to see libero swaps.',
  liberoOff: 'Libero switched off for this set',
  /** v4: the role a starter plays, for screen readers (the tag on court shows the short code). */
  roleLabel: (role: string, offPosition: boolean) =>
    `role ${role}${offPosition ? ', not one of their positions' : ''}`,
  liberoFor: (number: number | null) => (number === null ? 'L' : `L for #${number}`),
  liberoForLabel: (player: string, replaced: string) => `Libero ${player}, in for ${replaced}`,
} as const;
