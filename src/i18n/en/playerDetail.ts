/** v6: player detail screen + confidential descriptions (worker B). */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const playerDetail = {
  title: 'Player',
  edit: 'Edit',
  editLabel: (name: string) => `Edit ${name}`,
  number: (n: number) => `#${n}`,
  /** Separators: between short items, between sentences, in a list. */
  separator: ' · ',
  sentenceSeparator: '. ',
  listSeparator: ', ',
  headerLabel: (number: number, name: string, positions: string, status: string, captain = false) =>
    `Number ${number}, ${name}, ${captain ? 'captain, ' : ''}${positions}, ${status}`,
  /** v9.1: shown next to the positions of the team captain. */
  captain: 'Captain',
  /** "+3", "0", "−2" (plus/minus). */
  signed: (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'),
  season: {
    heading: 'All seasons',
    empty: 'No sets played yet. Stats appear once this player is on court in live mode.',
    setsStarted: 'Sets started',
    setsPlayed: 'Sets played',
    rallies: 'Rallies on court',
    ralliesValue: (on: number, all: number) => `${on} of ${all}`,
    ralliesLabel: (on: number, all: number) => `Rallies on court: ${on} of ${all} rallies`,
    plusMinus: '+/−',
    plusMinusLabel: (won: number, lost: number, value: string) =>
      `Plus/minus while on court: ${value} (${won} won, ${lost} lost)`,
    subIn: 'Subbed in',
    subOut: 'Subbed out',
    serveTurns: 'Serve turns',
    serves: 'Serves',
    servePoints: 'Points on serve',
    kills: 'Kills',
    aces: 'Aces',
    blocks: 'Blocks',
    errors: 'Errors',
    tileLabel: (label: string, value: string) => `${label}: ${value}`,
    breakdownHeading: 'Errors by type',
    breakdownItem: (count: number, name: string) => `${count} × ${name}`,
  },
  matches: {
    heading: 'Matches',
    vs: (opponent: string) => `vs ${opponent}`,
    line: (s: {
      sets: number;
      rallies: number;
      of: number;
      plusMinus: string;
      kills: number;
      aces: number;
      blocks: number;
      errors: number;
    }) =>
      `${plural(s.sets, 'set', 'sets')} · ${s.rallies}/${s.of} rallies · ${s.plusMinus} · ` +
      `K ${s.kills} · A ${s.aces} · B ${s.blocks} · E ${s.errors}`,
    lineLabel: (s: {
      sets: number;
      rallies: number;
      of: number;
      plusMinus: string;
      kills: number;
      aces: number;
      blocks: number;
      errors: number;
    }) =>
      `${plural(s.sets, 'set', 'sets')} played, ${s.rallies} of ${s.of} rallies on court, ` +
      `plus/minus ${s.plusMinus}, ${s.kills} kills, ${s.aces} aces, ${s.blocks} blocks, ` +
      `${s.errors} errors`,
    open: (opponent: string, date: string) =>
      `vs ${opponent}, ${date}. Open the performance in this match`,
  },
  description: {
    heading: 'Description',
    hint: 'Confidential notes about this player. Hidden until you unlock them.',
    show: 'Show descriptions',
    showLabel: 'Show descriptions (confidential, needs unlocking)',
    lock: 'Lock',
    lockLabel: 'Lock: hide all descriptions again',
    unlockedNote: 'Descriptions are visible until you lock them or leave the app.',
    prompt: 'Unlock confidential player descriptions',
    failed: 'Not unlocked. The descriptions stay hidden.',
    field: 'Description',
    placeholder: 'Notes only you should see',
    count: (n: number, max: number) => `${n} / ${max}`,
    save: 'Save description',
    saved: 'Description saved.',
    removed: 'Description removed.',
    confirmTitle: 'Confidential notes',
    confirmBody: 'These notes are confidential. Show them?',
    confirm: 'Show',
    cancel: 'Cancel',
  },
} as const;
