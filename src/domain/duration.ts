/** Durations for display (match length on the summary and the printed sheet). Pure. */

/** Whole hours and remaining minutes of a duration, rounded to the nearest minute. */
export function durationParts(ms: number): { hours: number; minutes: number } {
  const total = Math.round(ms / 60_000);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
