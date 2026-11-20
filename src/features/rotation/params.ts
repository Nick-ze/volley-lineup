import type { SetLineup, SetNumber } from '@/domain/types';

/**
 * Resolves the `?set=N` route param against the sets that exist in a match.
 * Falls back to the first existing set when the param is missing, malformed or unknown.
 */
export function resolveSet(
  raw: string | string[] | undefined,
  sets: readonly SetLineup[],
): SetLineup | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(value);
  return sets.find((s) => s.setNumber === n) ?? sets[0];
}

export function setNumbersOf(sets: readonly SetLineup[]): SetNumber[] {
  return sets.map((s) => s.setNumber);
}
