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
 * v8 → v9 (app 7.0): seasons / tournaments. Every team gets one season holding all its matches,
 * every distinct opponent name becomes an opponent of it (`upgradeToSeasons`, the same step as
 * for v7 export files); matches get `seasonId` + `opponentId`.
 * v9 → v10 (app 8.0): device settings `themeMode: 'dark'` (the look so far) and
 * `dyslexiaFont: false`; teams may have a `photoId` (optional, no data change).
 * v10 → v11 (app 9.0): device settings `tourMode: null` (the app asks once which tour to show)
 * and `tourSeen: []`.
 * v11 → v12 (app 9.1): teams may have a `captainId` (the team captain) — optional, so no data
 * changes.
 * v12 → v13 (app 10.0): device-only sync state `sync: { deviceId: null, account: null, teams: {} }`
 * (no account, no shared teams — the app behaves exactly as before until someone signs in).
 */
import {
  addRoleDefaults,
  addSetLogDefaults,
  isRecord as isRec,
  mapLineups,
  mapSets,
  type Rec,
} from '@/domain/legacyData';
import { upgradeLineupToFormation } from '@/domain/roles';
import { upgradeToSeasons } from '@/domain/seasons';
export const STORE_VERSION = 13;

function v1ToV2(state: Rec): Rec {
  return { language: 'en', ...state, matches: mapSets(state.matches, addSetLogDefaults) };
}

function v5ToV6(state: Rec): Rec {
  return { ...state, ...mapLineups(state, addRoleDefaults) };
}

/** v6 → v7: per-player role overrides become a formation per set and preset (roles.ts). */
function v6ToV7(state: Rec): Rec {
  return { ...state, ...mapLineups(state, (x) => upgradeLineupToFormation(x, state.players)) };
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
  if (fromVersion < 9 && isRec(state)) state = upgradeToSeasons(state);
  if (fromVersion < 10 && isRec(state))
    state = { themeMode: 'dark', dyslexiaFont: false, ...state };
  if (fromVersion < 11 && isRec(state)) state = { tourMode: null, tourSeen: [], ...state };
  // v11 → v12: `Team.captainId` is optional, so nothing changes.
  if (fromVersion < 13 && isRec(state))
    state = { sync: { deviceId: null, account: null, teams: {} }, ...state };
  return state;
}
