/**
 * Shared plumbing for upgrading old data shapes: the persisted store (`src/store/migrations.ts`)
 * and old export files (`exportUpgrades.ts`) walk the same matches / sets / presets. Each side
 * keeps its own version gates (store and file versions differ); only the traversal and the
 * per-lineup defaults live here.
 *
 * Old data is `unknown`: anything malformed is passed through untouched, so the caller's
 * validation (the zod schema, or the store) judges it. No imports — every upgrade may use this.
 */

export type Rec = Record<string, unknown>;

/** A plain object (not null, not an array). */
export const isRecord = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** `list` with `fn` applied to each item; anything but an array is returned as it is. */
export function mapList(list: unknown, fn: (item: unknown) => unknown): unknown {
  return Array.isArray(list) ? list.map(fn) : list;
}

/** The matches with `fn` applied to every set (malformed matches are kept as they are). */
export function mapSets(matches: unknown, fn: (set: unknown) => unknown): unknown {
  return mapList(matches, (m) =>
    isRecord(m) && Array.isArray(m.sets) ? { ...m, sets: m.sets.map(fn) } : m,
  );
}

/** `fn` applied to every lineup: each set of each match, and each preset. */
export function mapLineups(
  data: Rec,
  fn: (lineup: unknown) => unknown,
): { matches: unknown; presets: unknown } {
  return { matches: mapSets(data.matches, fn), presets: mapList(data.presets, fn) };
}

/** Store v1 → v2 / file v1 → v2: a set gains `liberoReplaces: []` and `events: []`. */
export const addSetLogDefaults = (set: unknown): unknown =>
  isRecord(set) ? { liberoReplaces: [], events: [], ...set } : set;

/**
 * Store v5 → v6 / file v4 → v5: a set or preset gains `roles: {}` (everyone plays their primary
 * position) and `liberoActive: true`.
 */
export const addRoleDefaults = (lineup: unknown): unknown =>
  isRecord(lineup) ? { roles: {}, liberoActive: true, ...lineup } : lineup;
