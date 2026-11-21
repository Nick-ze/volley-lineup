/**
 * Persisted store versioning. When the persisted shape changes:
 * 1. bump STORE_VERSION, 2. add a step that upgrades from the previous version.
 *
 * v1 → v2: every SetLineup gains `liberoReplaces: []` and `events: []`; the state gains
 * `language: 'en'`.
 * v2 → v3: the state gains `presets: []` (saved lineups and team starters).
 * v3 → v4: point events may carry `kind`, `playerId` and `at` (all optional) — no data change;
 * existing events stay valid as they are.
 * v4 → v5: the state gains `chipLabel: 'number'` (player chips show numbers, as before).
 */
export const STORE_VERSION = 5;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function v1ToV2(state: Rec): Rec {
  const matches = Array.isArray(state.matches)
    ? state.matches.map((m: unknown) =>
        isRec(m) && Array.isArray(m.sets)
          ? {
              ...m,
              sets: m.sets.map((set: unknown) =>
                isRec(set) ? { liberoReplaces: [], events: [], ...set } : set,
              ),
            }
          : m,
      )
    : state.matches;
  return { language: 'en', ...state, matches };
}

export function migrateStore(persisted: unknown, fromVersion: number): unknown {
  if (fromVersion > STORE_VERSION) {
    throw new Error(
      `Stored data version ${fromVersion} is newer than this app (${STORE_VERSION}).`,
    );
  }
  let state = persisted;
  if (fromVersion < 2 && isRec(state)) state = v1ToV2(state);
  if (fromVersion < 3 && isRec(state)) state = { presets: [], ...state };
  if (fromVersion < 5 && isRec(state)) state = { chipLabel: 'number', ...state };
  return state;
}
