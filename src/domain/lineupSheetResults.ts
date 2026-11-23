/**
 * The optional results section of the printable lineup sheet (v3, `withResults`).
 *
 * Part of the printable lineup sheet: `lineupSheet.ts` imports it, never the other way round.
 */
import { durationParts } from './duration';
import { escapeHtml } from './html';
import { getMatchState, type MatchState } from './matchState';
import type { Match } from './types';

/** Labels of the optional "with results" section (v3). */
export interface LineupSheetResultLabels {
  heading: string;
  /** Final result of a decided match, e.g. "Won" / "Lost"; "In progress" otherwise. */
  won: string;
  lost: string;
  inProgress: string;
  setsWon: string;
  /** e.g. "Set 1 25:21"; `open` is true for a set that is still being played. */
  setScore: (setNumber: number, us: number, them: number, open: boolean) => string;
  duration: string;
  /** e.g. "1 h 32 min" from whole hours and the remaining minutes. */
  durationValue: (hours: number, minutes: number) => string;
}

/** True once a rally of the match has been played, i.e. there are results to print. */
export function hasResults(match: Pick<Match, 'sets'>): boolean {
  return getMatchState(match).status !== 'notStarted';
}

export function renderResults(state: MatchState, labels: LineupSheetResultLabels): string {
  const status =
    state.status === 'won' ? labels.won : state.status === 'lost' ? labels.lost : labels.inProgress;
  const sets = state.sets
    .filter((set) => set.status !== 'notStarted')
    .map((set) => {
      const text = labels.setScore(
        set.setNumber,
        set.score.us,
        set.score.them,
        set.status === 'inProgress',
      );
      return `<li data-set-result="${set.setNumber}">${escapeHtml(text)}</li>`;
    })
    .join('');
  const line = (cls: string, label: string, value: string) =>
    `<div class="${cls}"><span class="label">${escapeHtml(label)}</span> ${escapeHtml(value)}</div>`;
  let duration = '';
  // Under a minute there is nothing useful to show (no "0 min").
  if (state.durationMs !== null && state.durationMs >= 60_000) {
    const { hours, minutes } = durationParts(state.durationMs);
    duration = line('duration', labels.duration, labels.durationValue(hours, minutes));
  }
  return (
    `<section class="results" data-status="${state.status}">` +
    `<h2>${escapeHtml(labels.heading)}</h2>` +
    `<div class="final">${escapeHtml(status)}</div>` +
    line('sets-won', labels.setsWon, `${state.setsWon.us}:${state.setsWon.them}`) +
    `<ul class="set-scores">${sets}</ul>` +
    duration +
    `</section>`
  );
}
