/**
 * Export / import file format (docs/PLAN.md §3.8, §6 `ExportFile`).
 *
 * Pure functions only: building an export, parsing + validating an import, and turning an
 * import into new app data (merge or replace). No React, no storage, no user-facing text —
 * errors are returned as codes that the UI maps to strings.
 *
 * This file builds and parses files and re-exports the rest, so `@/domain/exportSchema` stays
 * the one import path: the format and zod schemas (`exportFormat.ts`), the file upgrades
 * (`exportUpgrades.ts`), the consistency checks (`exportConsistency.ts`) and replace / merge
 * (`exportMerge.ts`). Those modules import each other directly, never this barrel.
 */
import { pad2 } from './dates';
import { isConsistent } from './exportConsistency';
import {
  EXPORT_APP_ID,
  EXPORT_SCHEMA_VERSION,
  exportFileSchema,
  SUPPORTED_IMPORT_VERSIONS,
  type TransferData,
} from './exportFormat';
import { upgradeToCurrent } from './exportUpgrades';
import { isRecord } from './legacyData';
import { keepReferencedPhotos, withoutDanglingPhoto, withoutDescription } from './photos';
import type { ExportFile } from './types';

export * from './exportFormat';
export * from './exportConsistency';
export * from './exportMerge';

/* ------------------------------------------------------------------ export */

export interface BuildExportOptions {
  /**
   * Export only this team (plus its owning profile, players, matches, presets, seasons with
   * their opponents, and the photos they refer to).
   */
  teamId?: string;
  /** Timestamp to write into `exportedAt` (defaults to now). */
  now?: Date;
  /**
   * v7: keep the players' confidential descriptions (default false: they are left out). The UI
   * only offers this while descriptions are unlocked.
   */
  includeDescriptions?: boolean;
}

/**
 * Builds an export of everything, or of a single team when `teamId` is given. v7: the photos
 * of the exported profiles, players and (v9) teams go with it (orphans never); descriptions only with
 * `includeDescriptions`.
 */
export function buildExport(data: TransferData, options: BuildExportOptions = {}): ExportFile {
  const exportedAt = (options.now ?? new Date()).toISOString();
  const base = { app: EXPORT_APP_ID, schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt };
  const teamId = options.teamId;
  // A photo id whose photo is missing (e.g. a storage write failed) is left out, so the file
  // always imports (v6 QA).
  const photoIds = new Set(data.photos.map((p) => p.id));
  const teams = (
    teamId === undefined ? [...data.teams] : data.teams.filter((t) => t.id === teamId)
  ).map((t) => withoutDanglingPhoto(t, photoIds));
  const profileIds = new Set(teams.map((t) => t.profileId));
  const profiles =
    teamId === undefined ? [...data.profiles] : data.profiles.filter((p) => profileIds.has(p.id));
  const players = (
    teamId === undefined ? [...data.players] : data.players.filter((p) => p.teamId === teamId)
  ).map((p) =>
    withoutDanglingPhoto(
      options.includeDescriptions === true ? p : withoutDescription(p),
      photoIds,
    ),
  );
  const byTeam = <T extends { teamId: string }>(list: readonly T[]): T[] =>
    teamId === undefined ? [...list] : list.filter((x) => x.teamId === teamId);
  const seasons = byTeam(data.seasons);
  const seasonIds = new Set(seasons.map((x) => x.id));
  return {
    ...base,
    profiles: profiles.map((p) => withoutDanglingPhoto(p, photoIds)),
    teams,
    players,
    matches: byTeam(data.matches),
    presets: byTeam(data.presets),
    photos: keepReferencedPhotos(data.photos, { profiles, players, teams }),
    seasons,
    opponents: data.opponents.filter((o) => seasonIds.has(o.seasonId)),
  };
}

/** Lowercase ASCII slug of a name (`"Herren 1 – Süd"` → `"herren-1-sud"`), `"team"` if empty. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'team';
}

/** `volley-lineup-2026-11-20.json`, or `volley-lineup-herren-1-2026-11-20.json` for a team. */
export function exportFileName(now: Date, teamName?: string): string {
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const team = teamName === undefined ? '' : `${slugify(teamName)}-`;
  return `${EXPORT_APP_ID}-${team}${date}.json`;
}

/** Pretty-printed JSON text of an export file. */
export function serializeExport(file: ExportFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/* ------------------------------------------------------------------ import */

export type ImportErrorCode =
  | 'INVALID_JSON'
  | 'NOT_VOLLEY_LINEUP'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_SHAPE'
  | 'INCONSISTENT_REFERENCES';

export interface ImportSummary {
  profiles: number;
  teams: number;
  players: number;
  matches: number;
  presets: number;
  /** v7: pictures in the file. */
  photos: number;
  /** v7: players with a description in the file. */
  descriptions: number;
  /** v8: seasons / tournaments in the file. */
  seasons: number;
}

export type ParseImportResult =
  { ok: true; file: ExportFile; summary: ImportSummary } | { ok: false; error: ImportErrorCode };

export function summarize(data: TransferData): ImportSummary {
  return {
    profiles: data.profiles.length,
    teams: data.teams.length,
    players: data.players.length,
    matches: data.matches.length,
    presets: data.presets.length,
    photos: data.photos.length,
    descriptions: data.players.filter((p) => p.description !== undefined).length,
    seasons: data.seasons.length,
  };
}

/**
 * Parses and validates the text of an import file. Checks, in order: valid JSON, our app id,
 * the schema version, the shape (zod), then cross-references (`isConsistent`).
 */
export function parseImport(jsonText: string): ParseImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
  if (!isRecord(raw) || raw.app !== EXPORT_APP_ID) return { ok: false, error: 'NOT_VOLLEY_LINEUP' };
  if (
    typeof raw.schemaVersion !== 'number' ||
    !SUPPORTED_IMPORT_VERSIONS.includes(raw.schemaVersion)
  ) {
    return { ok: false, error: 'UNSUPPORTED_VERSION' };
  }
  const parsed = exportFileSchema.safeParse(upgradeToCurrent(raw));
  if (!parsed.success) return { ok: false, error: 'INVALID_SHAPE' };
  // The store keeps sets ordered by set number; do the same for imported files. Photos no
  // profile, player or (v9) team refers to are dropped (v7).
  const file: ExportFile = {
    ...parsed.data,
    matches: parsed.data.matches.map((m) => ({
      ...m,
      sets: [...m.sets].sort((a, b) => a.setNumber - b.setNumber),
    })),
    photos: keepReferencedPhotos(parsed.data.photos, parsed.data),
  };
  if (!isConsistent(file)) return { ok: false, error: 'INCONSISTENT_REFERENCES' };
  return { ok: true, file, summary: summarize(file) };
}
