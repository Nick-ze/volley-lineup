/**
 * Upgrades of older export files to the current schema version, step by step
 * (`upgradeToCurrent`). Old data is `unknown`: anything malformed is passed through for the zod
 * check to report as INVALID_SHAPE.
 *
 * Sub-module of the `exportSchema.ts` barrel: import siblings directly, never the barrel.
 */
import {
  addRoleDefaults,
  addSetLogDefaults,
  isRecord,
  mapLineups,
  mapSets,
  type Rec,
} from './legacyData';
import { upgradeLineupToFormation } from './roles';
import { upgradeToSeasons } from './seasonUpgrade';

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
 * per team with its opponents, `upgradeToSeasons`), v8 → v9 (teams may have a `photoId`, which
 * is optional, so nothing changes), v9 → v10 (teams may have a `captainId`, also optional, so
 * nothing changes), v10 → v11 (app 12.0: the three empty hosted-tournament collections),
 * v11 → v12 (app 12.1: every hosted tournament gains `plan: 'roundRobin'`), v12 → v13 (app 12.2:
 * the empty list of hosted teams' players; player labels and live rallies are optional),
 * v13 → v14 (app 12.4: the matches of a tournament with own matches get the time they were
 * added, `withMatchTimes`).
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
  const v9 = v8.schemaVersion === 8 ? { ...v8, schemaVersion: 9 } : v8;
  // v9 → v10 (app 9.1): teams may have a `captainId` (optional), so nothing changes.
  const v10 = v9.schemaVersion === 9 ? { ...v9, schemaVersion: 10 } : v9;
  // v10 → v11 (app 12.0): hosted tournaments; older files have none.
  const v11 =
    v10.schemaVersion === 10
      ? { hostedTournaments: [], hostedTeams: [], hostedResults: [], ...v10, schemaVersion: 11 }
      : v10;
  // v11 → v12 (app 12.1): so far the app made every plan.
  const v12 =
    v11.schemaVersion === 11
      ? { ...v11, schemaVersion: 12, hostedTournaments: withRoundRobinPlan(v11.hostedTournaments) }
      : v11;
  // v12 → v13 (app 12.2): hosted teams may have players; older files have none.
  const v13 = v12.schemaVersion === 12 ? { hostedPlayers: [], ...v12, schemaVersion: 13 } : v12;
  // v13 → v14 (app 12.4): own matches are ordered by when they were added.
  return v13.schemaVersion === 13
    ? {
        ...v13,
        schemaVersion: 14,
        hostedResults: withMatchTimes(v13.hostedTournaments, v13.hostedResults),
      }
    : v13;
}

/**
 * v13 → v14 (also the store's v16 → v17 step): every match of a tournament with own matches
 * that has no `addedAt` gets one that keeps the list's order — the tournament's creation time
 * plus one millisecond per place. A round robin's results get none. Anything that isn't a list
 * of records is passed through for the shape check to report.
 */
export function withMatchTimes(tournaments: unknown, results: unknown): unknown {
  if (!Array.isArray(tournaments) || !Array.isArray(results)) return results;
  const start = new Map<unknown, number>();
  for (const x of tournaments) {
    if (!isRecord(x) || x.plan !== 'manual') continue;
    const created = typeof x.createdAt === 'string' ? Date.parse(x.createdAt) : NaN;
    start.set(x.id, Number.isFinite(created) ? created : 0);
  }
  const place = new Map<unknown, number>();
  return results.map((r) => {
    if (!isRecord(r) || !start.has(r.tournamentId)) return r;
    const n = place.get(r.tournamentId) ?? 0;
    place.set(r.tournamentId, n + 1);
    if (typeof r.addedAt === 'string') return r;
    const at = new Date((start.get(r.tournamentId) as number) + n).toISOString();
    return { ...r, addedAt: at };
  });
}

/**
 * v11 → v12 (also the store's v14 → v15 step): hosted tournaments from before 12.1 get
 * `plan: 'roundRobin'`. Anything that isn't a list of records is passed through for the shape
 * check to report.
 */
export function withRoundRobinPlan(tournaments: unknown): unknown {
  if (!Array.isArray(tournaments)) return tournaments;
  return tournaments.map((x) => (isRecord(x) ? { plan: 'roundRobin', ...x } : x));
}
