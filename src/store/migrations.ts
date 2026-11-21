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
 * v5 → v6: every set and preset gains `roles: {}` (everyone plays their primary position) and
 * `liberoActive: true`.
 * v6 → v7: the per-player `roles` become a `formation` per set and preset (5-1 / 6-2, inferred
 * from where the setter stands; `upgradeLineupToFormation`).
 * v7 → v8 (app 6.0): profiles and players may have a `photoId`, players a `description`, and
 * "our error" tags an `errorType` — all optional, so no data changes. The photos themselves are
 * stored under their own keys (`photoStore.ts`), not in this store.
 */
import { upgradeLineupToFormation } from '@/domain/roles';
export const STORE_VERSION = 8;

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

function v5ToV6(state: Rec): Rec {
  const lineupDefaults = (x: unknown) => (isRec(x) ? { roles: {}, liberoActive: true, ...x } : x);
  const matches = Array.isArray(state.matches)
    ? state.matches.map((m: unknown) =>
        isRec(m) && Array.isArray(m.sets) ? { ...m, sets: m.sets.map(lineupDefaults) } : m,
      )
    : state.matches;
  const presets = Array.isArray(state.presets) ? state.presets.map(lineupDefaults) : state.presets;
  return { ...state, matches, presets };
}

/** v6 → v7: per-player role overrides become a formation per set and preset (roles.ts). */
function v6ToV7(state: Rec): Rec {
  const toFormation = (x: unknown) => upgradeLineupToFormation(x, state.players);
  const matches = Array.isArray(state.matches)
    ? state.matches.map((m: unknown) =>
        isRec(m) && Array.isArray(m.sets) ? { ...m, sets: m.sets.map(toFormation) } : m,
      )
    : state.matches;
  const presets = Array.isArray(state.presets) ? state.presets.map(toFormation) : state.presets;
  return { ...state, matches, presets };
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
  if (fromVersion < 6 && isRec(state)) state = v5ToV6(state);
  if (fromVersion < 7 && isRec(state)) state = v6ToV7(state);
  return state;
}
