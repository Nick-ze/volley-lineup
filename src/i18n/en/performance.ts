import type { ErrorCategory } from '@/domain/performance';

import { tags } from './tags';

/** Plural of `tags.errorTypeNames` ("2 reception errors"). */
const errorTypePlurals: Record<ErrorCategory, string> = {
  serve: 'serve errors',
  reception: 'reception errors',
  attack: 'attack errors',
  block: 'block errors',
  set: 'setting errors',
  netFault: 'net / fouls',
  other: 'other errors',
  unspecified: 'unspecified errors',
};

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const rallies = (n: number) => (n === 1 ? '1 rally' : `${n} rallies`);

/** v6: performance view of a match / set (docs/PLAN.md §25.4). */
export const performance = {
  title: 'Performance',
  /** The link on the match screen. */
  open: 'Performance',
  openLabel: 'Performance of every player in this match',
  heading: (opponent: string) => `Performance vs ${opponent}`,
  notFound: 'This match could not be found.',
  empty: 'No set played yet. Performance appears once rallies are recorded in live mode.',
  filter: {
    label: 'Show performance for',
    all: 'All sets',
    allLabel: 'All sets: performance of the whole match',
    set: (n: number) => `Set ${n}`,
    setLabel: (n: number) => `Set ${n}: performance in this set`,
  },
  playerRef: (number: number, name: string) => `#${number} ${name}`,
  signed,
  rallies,
  /** "20–14 (+6)": rallies won – lost while on court, plus/minus. */
  record: (won: number, lost: number) => `${won}–${lost} (${signed(won - lost)})`,
  recordLabel: (won: number, lost: number) =>
    `${won} won, ${lost} lost while on court, plus/minus ${signed(won - lost)}`,
  /** "K 3 · A 1 · B 0 · E 2 · Net +2". */
  actions: (k: number, a: number, b: number, e: number, net: number) =>
    `K ${k} · A ${a} · B ${b} · E ${e} · Net ${signed(net)}`,
  actionsLabel: (k: number, a: number, b: number, e: number, net: number) =>
    `kills ${k}, aces ${a}, blocks ${b}, errors ${e}, net points ${signed(net)}`,
  rating: { positive: 'Positive', even: 'Even', negative: 'Negative', none: 'No rallies' },
  ratingSymbol: { positive: '▲', even: '●', negative: '▼', none: '–' },
  ratingLabel: (rating: string) => `rating ${rating}`,
  /** Screen-reader text of a player card; starts with the visible name. */
  rowLabel: (ref: string, parts: string) => `${ref}: ${parts}. Show details`,
  legendHeading: 'How to read it',
  legendRating:
    '▲ Positive / ● Even / ▼ Negative: kills + aces + blocks minus errors (net points). Without tagged points: rallies won minus lost while on court.',
  legendActions: 'K = kills, A = aces, B = blocks, E = errors, Net = K + A + B − E.',
  /* Player detail */
  back: '‹ All players',
  backLabel: 'All players: back to the overview',
  onCourt: 'On court',
  ralliesOf: (n: number, total: number) => `${n} of ${rallies(total)}`,
  wonLost: 'Won – lost',
  wonLostValue: (won: number, lost: number) => `${won} won, ${lost} lost (${signed(won - lost)})`,
  errorRate: 'Error rate',
  errorRateHint: 'Errors per rally on court.',
  errorRateValue: (pct: string, errors: number, onCourt: number) =>
    `${pct} (${errors === 1 ? '1 error' : `${errors} errors`} in ${rallies(onCourt)})`,
  errorsPerAction: 'Errors per action',
  errorsPerActionHint:
    'Share of the tagged actions (kills, aces, blocks, errors) that were errors.',
  serveErrorRate: 'Serve error rate',
  serveErrorRateHint: 'Serve errors per serve.',
  attackErrorRate: 'Attack error rate',
  attackErrorRateHint: 'Attack errors per attack that ended the rally (kills + attack errors).',
  errorsByType: 'Errors by type',
  noErrors: 'No errors',
  /** "1 reception error" / "2 attack errors". */
  errorCount: (category: ErrorCategory, n: number) =>
    `${n} ${n === 1 ? tags.errorTypeNames[category] : errorTypePlurals[category]}`,
  kills: 'Kills',
  aces: 'Aces',
  blocks: 'Blocks',
  serves: 'Serves',
  servePoints: 'Points on serve',
  none: '–',
  percent: (n: number) => `${n}%`,
  /** Screen-reader text of a detail line. */
  lineLabel: (label: string, value: string) => `${label}: ${value}`,
};
