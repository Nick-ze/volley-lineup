/**
 * Parses a `?tab=` route param against a screen's tab list: the first value of an array param,
 * and `fallback` for anything unknown or missing.
 */
export function parseTab<T extends string>(
  tabs: readonly T[],
  value: string | string[] | undefined,
  fallback: T,
): T {
  const v = Array.isArray(value) ? value[0] : value;
  return tabs.find((tab) => tab === v) ?? fallback;
}
