/**
 * v6.2: searching a team's matches by opponent name or date (Matches tab). Pure functions, no
 * React, no storage.
 *
 * The query is split into words; every word must match the opponent (case- and accent-
 * insensitive, anywhere in the name) or the date (`YYYY-MM-DD` as stored). A date word may be
 * a part of the stored date ("2026-11", "11-21"), German style "21.11." / "21.11.2026" /
 * "21.11.26", or US style "11/21" / "11/21/2026". An empty query matches everything.
 */
import { pad2 as pad } from './dates';
import type { Match } from './types';

/** Lower case without accents ("Müller" → "muller"). */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** True when `year` (2 or 4 digits) is the stored 4-digit year. */
const yearMatches = (stored: string, year: string | undefined) =>
  year === undefined || year === '' || stored.endsWith(year);

/** True when one query word matches the stored `YYYY-MM-DD` date. */
export function dateMatches(date: string, word: string): boolean {
  if (date.includes(word)) return true;
  const parts = date.split('-'); // split always returns at least one part
  const year = parts[0] as string;
  const [, month = '', day = ''] = parts;
  const german = /^(\d{1,2})\.(\d{1,2})\.?(\d{2}|\d{4})?$/.exec(word);
  if (german) {
    return (
      pad(german[1] as string) === day &&
      pad(german[2] as string) === month &&
      yearMatches(year, german[3])
    );
  }
  const us = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
  if (us) {
    return (
      pad(us[1] as string) === month && pad(us[2] as string) === day && yearMatches(year, us[3])
    );
  }
  return false;
}

/** True when the match fits the search query (see the module comment). */
export function matchFitsQuery(match: Pick<Match, 'opponent' | 'date'>, query: string): boolean {
  const opponent = fold(match.opponent);
  return fold(query)
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => opponent.includes(word) || dateMatches(match.date, word));
}

/** The matches that fit the query, in the given order. */
export function searchMatches<T extends Pick<Match, 'opponent' | 'date'>>(
  matches: readonly T[],
  query: string,
): T[] {
  return matches.filter((m) => matchFitsQuery(m, query));
}
