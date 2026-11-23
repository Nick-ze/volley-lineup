/**
 * Upgrades of older export files to the current schema version, step by step
 * (`upgradeToCurrent`). Old data is `unknown`: anything malformed is passed through for the zod
 * check to report as INVALID_SHAPE.
 *
 * Sub-module of the `exportSchema.ts` barrel: import siblings directly, never the barrel.
 */
import { addRoleDefaults, addSetLogDefaults, mapLineups, mapSets, type Rec } from './legacyData';
import { upgradeLineupToFormation } from './roles';
import { upgradeToSeasons } from './seasons';

/**
 * v1 → v2: sets gain `liberoReplaces: []` and `events: []`. Anything malformed is passed through
 * untouched so the zod check reports it as INVALID_SHAPE.
 */
function upgradeV1(raw: Rec): Rec {
  return { ...raw, schemaVersion: 2, matches: mapSets(raw.matches, addSetLogDefaults) };
}

/** v4 → v5: every set and preset gains `roles: {}` (primary positions) and `liberoActive: true`. */
function upgradeV4(raw: Rec): Rec {
  return { ...raw, schemaVersion: 5, ...mapLineups(raw, addRoleDefaults) };
}

/** v5 → v6: per-player role overrides become a formation per set and preset (roles.ts). */
function upgradeV5(raw: Rec): Rec {
  const toFormation = (x: unknown) => upgradeLineupToFormation(x, raw.players);
  return { ...raw, schemaVersion: 6, ...mapLineups(raw, toFormation) };
}

/**
 * Upgrades an older file step by step: v1 → v2 (sets), v2 → v3 (`presets: []`), v3 → v4 (no data
 * change: untagged points without timestamps stay valid), v4 → v5 (roles + libero on/off),
 * v5 → v6 (roles become a formation per lineup), v6 → v7 (`photos: []`; photo ids,
 * descriptions and error types are optional, so nothing else changes), v7 → v8 (one season
 * per team with its opponents, `upgradeToSeasons`).
 */
export function upgradeToCurrent(raw: Rec): Rec {
  const v2 = raw.schemaVersion === 1 ? upgradeV1(raw) : raw;
  const v3 = v2.schemaVersion === 2 ? { presets: [], ...v2, schemaVersion: 3 } : v2;
  const v4 = v3.schemaVersion === 3 ? { ...v3, schemaVersion: 4 } : v3;
  const v5 = v4.schemaVersion === 4 ? upgradeV4(v4) : v4;
  const v6 = v5.schemaVersion === 5 ? upgradeV5(v5) : v5;
  const v7 = v6.schemaVersion === 6 ? { photos: [], ...v6, schemaVersion: 7 } : v6;
  const v8 = v7.schemaVersion === 7 ? { ...upgradeToSeasons(v7), schemaVersion: 8 } : v7;
  // v8 → v9: teams may have a `photoId` (optional), so nothing changes.
  return v8.schemaVersion === 8 ? { ...v8, schemaVersion: 9 } : v8;
}
