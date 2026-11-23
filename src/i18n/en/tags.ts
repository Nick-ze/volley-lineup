/** Optional point tagging in live mode (v3, docs/PLAN.md §15.3). */
export const tags = {
  title: 'Point details',
  /** Short chip text per kind. */
  kinds: {
    kill: 'Kill',
    ace: 'Ace',
    block: 'Block',
    opponentError: 'Opp. error',
    ourError: 'Our error',
    opponentKill: 'Their kill',
    opponentAce: 'Their ace',
  },
  /** Spoken / undo-label name per kind. */
  kindNames: {
    kill: 'kill',
    ace: 'ace',
    block: 'block',
    opponentError: 'opponent error',
    ourError: 'our error',
    opponentKill: 'their kill',
    opponentAce: 'their ace',
  },
  /** v6: chip text per error type of "our error" (docs/VOLLEYBALL_RULES.md §7). */
  errorTypes: {
    serve: 'Serve',
    reception: 'Reception',
    attack: 'Attack',
    block: 'Block',
    set: 'Set',
    netFault: 'Net / foul',
    other: 'Other',
    unspecified: 'Unspecified',
  },
  /** v6: spoken / sentence name per error type ("3 reception errors"). */
  errorTypeNames: {
    serve: 'serve error',
    reception: 'reception error',
    attack: 'attack error',
    block: 'block error',
    set: 'setting error',
    netFault: 'net / foul',
    other: 'other error',
    unspecified: 'unspecified error',
  },
  /** v6: error type as named in the undo label ("our error (serve) #7 Smith"). */
  errorTypeDetail: {
    serve: 'serve',
    reception: 'reception',
    attack: 'attack',
    block: 'block',
    set: 'set',
    netFault: 'net / foul',
    other: 'other',
  },
  /** v6: "our error (serve)". */
  kindWithErrorType: (kind: string, type: string) => `${kind} (${type})`,
  errorTypesLabel: 'Optional: what kind of error?',
  /** v6: label of an error-type chip; starts with its visible text. */
  chooseErrorType: (type: string) => `${type}: error type of our error`,
  clearErrorType: (type: string) => `${type}: remove the error type`,
  rowLabel: (us: boolean) =>
    us ? 'Optional: how did we win the point?' : 'Optional: how did we lose the point?',
  chooseKind: (shown: string, name: string) => `${shown}: tag the last point as ${name}`,
  clearKind: (shown: string, name: string) => `${shown}: remove the tag ${name}`,
  playersLabel: (kind: string) => `Optional: which player? (${kind})`,
  /** v8.3: `ref` is the chip text ("#7 Anna"), `desc` the full description. */
  choosePlayer: (ref: string, desc: string, kind: string) => `${ref}: ${desc}, ${kind}`,
  clearPlayer: (ref: string, desc: string) => `${ref}: ${desc}, remove from the tag`,
  close: '✕',
  skipLabel: 'Skip point details',
  doneLabel: 'Close point details',
  /** "kill #7 Smith": the tag as named in the undo label. */
  detail: (kind: string, player: string | null) => (player ? `${kind} ${player}` : kind),
  /** "Undo last point for us · kill #7 Smith". */
  withDetail: (undo: string, detail: string) => `${undo} · ${detail}`,
} as const;
