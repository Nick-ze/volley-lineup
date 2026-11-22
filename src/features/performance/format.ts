import { errorBreakdown, type PlayerPerformance } from '@/domain/performance';
import { fullName } from '@/domain/playerNames';
import type { Player } from '@/domain/types';
import type { Strings } from '@/i18n';

/** "#7 Anna Smith" (first name first; the card truncates the end when space is short). */
export function performanceRef(t: Strings, p: Player): string {
  return t.performance.playerRef(p.number, fullName(p));
}

/** A rate (0–1) as a whole percentage, or "–" when it can't be computed. */
export function percentText(t: Strings, rate: number | null): string {
  return rate === null ? t.performance.none : t.performance.percent(Math.round(rate * 100));
}

/** "1 reception error, 2 attack errors" (display order), or "No errors". */
export function breakdownText(t: Strings, p: Pick<PlayerPerformance, 'errorsByType'>): string {
  const parts = errorBreakdown(p).map(({ category, count }) =>
    t.performance.errorCount(category, count),
  );
  return parts.length === 0 ? t.performance.noErrors : parts.join(', ');
}
