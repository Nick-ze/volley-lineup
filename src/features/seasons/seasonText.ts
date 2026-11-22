import { formatOptionalDate } from '@/domain/dates';
import type { OpponentRecord } from '@/domain/seasons';
import type { SeasonOverview } from '@/domain/stats';
import type { Season } from '@/domain/types';
import type { Strings } from '@/i18n';

/** Dates and place of a season on one line ("01.09.26 – 30.04.27 · Munich"), or ''. */
export function seasonWhenWhere(t: Strings, season: Season): string {
  const dates = t.seasons.dates(
    formatOptionalDate(season.startDate),
    formatOptionalDate(season.endDate),
  );
  return [dates, season.location ?? ''].filter((x) => x !== '').join(' · ');
}

/** "5 matches · 3–1" (the record only once a match has been played). */
export function seasonSummary(t: Strings, matchCount: number, overview: SeasonOverview): string {
  const count = t.seasons.list.matchCount(matchCount);
  return overview.played === 0
    ? count
    : `${count} · ${t.seasons.list.record(overview.won, overview.lost)}`;
}

/** "3–1 · 4 played · 1 upcoming · sets 9:4" (in progress only when there is one). */
export function recordLine(t: Strings, r: OpponentRecord): string {
  const s = t.seasons.opponents;
  return [
    s.record(r.won, r.lost),
    s.played(r.played),
    r.inProgress > 0 ? s.inProgress(r.inProgress) : '',
    s.upcoming(r.upcoming),
    s.sets(r.setsWon, r.setsLost),
  ]
    .filter((x) => x !== '')
    .join(' · ');
}
