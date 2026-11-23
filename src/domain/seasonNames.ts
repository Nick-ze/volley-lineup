/**
 * Season / opponent name rules: kinds, lengths, and how names are compared and cleaned.
 *
 * Part of the `seasons.ts` barrel: import sibling modules directly, never the barrel.
 */
import type { SeasonKind } from './types';

export const SEASON_KINDS: readonly SeasonKind[] = ['season', 'tournament'] as const;
export const MAX_SEASON_NAME_LENGTH = 40;
export const MAX_OPPONENT_NAME_LENGTH = 60;
export const MAX_LOCATION_LENGTH = 80;

/** Lower case, no accents, single spaces: how names are compared ("München " ≈ "munchen"). */
export function foldName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * An opponent / season name as stored by the upgrade: trimmed, inner spaces collapsed, at most
 * `max` characters; an empty name becomes "?" (v7 QA: no blank rows).
 */
export function cleanName(name: string, max = MAX_OPPONENT_NAME_LENGTH): string {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, max).trim();
  return clean === '' ? '?' : clean;
}
