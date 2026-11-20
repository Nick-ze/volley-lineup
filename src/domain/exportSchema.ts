/**
 * Export / import file format (docs/PLAN.md §3.8, §6 `ExportFile`).
 *
 * Pure functions only: building an export, parsing + validating an import, and turning an
 * import into new app data (merge or replace). No React, no storage, no user-facing text —
 * errors are returned as codes that the UI maps to strings.
 */
import { z } from 'zod';

import type { ExportFile, ManagerProfile, Match, Player, Position, SetLineup, Team } from './types';
import { ALL_POSITIONS } from './types';

export const EXPORT_APP_ID = 'volley-lineup' as const;
export const EXPORT_SCHEMA_VERSION = 1 as const;

/**
 * The four persisted collections. Derived from `ExportFile` (the domain layer can't import the
 * store); it is structurally identical to the store's `AppData`.
 */
export type TransferData = Pick<ExportFile, 'profiles' | 'teams' | 'players' | 'matches'>;

/* ------------------------------------------------------------------ schema */

const id = z.string().min(1);
const playerRef = id.nullable();

const positionSchema = z.enum(ALL_POSITIONS as [Position, ...Position[]]);

const profileSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
});

const teamSchema = z.object({
  id,
  profileId: id,
  name: z.string(),
  season: z.string().optional(),
  createdAt: z.string(),
});

const playerSchema = z.object({
  id,
  teamId: id,
  firstName: z.string(),
  lastName: z.string(),
  number: z.number().int().nonnegative(),
  positions: z.array(positionSchema).min(1),
  active: z.boolean(),
});

const setLineupSchema = z.object({
  setNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  slots: z.object({
    1: playerRef,
    2: playerRef,
    3: playerRef,
    4: playerRef,
    5: playerRef,
    6: playerRef,
  }),
  liberoId: playerRef,
  weServeFirst: z.boolean(),
});

const matchSchema = z.object({
  id,
  teamId: id,
  opponent: z.string(),
  date: z.string(),
  home: z.boolean(),
  sets: z.array(setLineupSchema).min(1).max(5),
});

export const exportFileSchema = z.object({
  app: z.literal(EXPORT_APP_ID),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  profiles: z.array(profileSchema),
  teams: z.array(teamSchema),
  players: z.array(playerSchema),
  matches: z.array(matchSchema),
});

/*
 * Compile-time guard: the zod schemas must describe exactly the types in ./types.ts.
 * If either side changes without the other, `npm run typecheck` fails here.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SchemaMatchesTypes = [
  Assert<Same<z.infer<typeof profileSchema>, ManagerProfile>>,
  Assert<Same<z.infer<typeof teamSchema>, Team>>,
  Assert<Same<z.infer<typeof playerSchema>, Player>>,
  Assert<Same<z.infer<typeof setLineupSchema>, SetLineup>>,
  Assert<Same<z.infer<typeof matchSchema>, Match>>,
  Assert<Same<z.infer<typeof exportFileSchema>, ExportFile>>,
];

/* ------------------------------------------------------------------ export */

export interface BuildExportOptions {
  /** Export only this team (plus its owning profile, players and matches). */
  teamId?: string;
  /** Timestamp to write into `exportedAt` (defaults to now). */
  now?: Date;
}

/** Builds an export of everything, or of a single team when `teamId` is given. */
export function buildExport(data: TransferData, options: BuildExportOptions = {}): ExportFile {
  const exportedAt = (options.now ?? new Date()).toISOString();
  const base = { app: EXPORT_APP_ID, schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt };
  if (options.teamId === undefined) {
    return {
      ...base,
      profiles: [...data.profiles],
      teams: [...data.teams],
      players: [...data.players],
      matches: [...data.matches],
    };
  }
  const teamId = options.teamId;
  const teams = data.teams.filter((t) => t.id === teamId);
  const profileIds = new Set(teams.map((t) => t.profileId));
  return {
    ...base,
    profiles: data.profiles.filter((p) => profileIds.has(p.id)),
    teams,
    players: data.players.filter((p) => p.teamId === teamId),
    matches: data.matches.filter((m) => m.teamId === teamId),
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
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
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
}

export type ParseImportResult =
  { ok: true; file: ExportFile; summary: ImportSummary } | { ok: false; error: ImportErrorCode };

export function summarize(data: TransferData): ImportSummary {
  return {
    profiles: data.profiles.length,
    teams: data.teams.length,
    players: data.players.length,
    matches: data.matches.length,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const hasDuplicates = (values: readonly (string | number)[]): boolean =>
  new Set(values).size !== values.length;

/**
 * True when the data is internally consistent:
 * - ids are unique within each collection;
 * - every team's profile, every player's / match's team exists;
 * - jersey numbers are unique within a team;
 * - set numbers are unique within a match;
 * - every lineup slot / libero refers to a player of the match's own team;
 * - within a set, no player is in two slots and the libero is not also a starter.
 */
export function isConsistent(data: TransferData): boolean {
  const { profiles, teams, players, matches } = data;
  if ([profiles, teams, players, matches].some((list) => hasDuplicates(list.map((x) => x.id)))) {
    return false;
  }
  const profileIds = new Set(profiles.map((p) => p.id));
  const teamIds = new Set(teams.map((t) => t.id));
  if (!teams.every((t) => profileIds.has(t.profileId))) return false;
  if (!players.every((p) => teamIds.has(p.teamId))) return false;
  if (!matches.every((m) => teamIds.has(m.teamId))) return false;

  const teamOfPlayer = new Map(players.map((p) => [p.id, p.teamId]));
  for (const teamId of teamIds) {
    const numbers = players.filter((p) => p.teamId === teamId).map((p) => p.number);
    if (hasDuplicates(numbers)) return false;
  }
  return matches.every((m) => {
    if (hasDuplicates(m.sets.map((s) => s.setNumber))) return false;
    return m.sets.every((set) => {
      const starters = Object.values(set.slots).filter((x): x is string => x !== null);
      if (hasDuplicates(starters)) return false; // a player in two slots
      if (set.liberoId !== null && starters.includes(set.liberoId)) return false;
      return [...starters, set.liberoId].every(
        (playerId) => playerId === null || teamOfPlayer.get(playerId) === m.teamId,
      );
    });
  });
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
  if (raw.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: 'UNSUPPORTED_VERSION' };
  }
  const parsed = exportFileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'INVALID_SHAPE' };
  // The store keeps sets ordered by set number; do the same for imported files.
  const file: ExportFile = {
    ...parsed.data,
    matches: parsed.data.matches.map((m) => ({
      ...m,
      sets: [...m.sets].sort((a, b) => a.setNumber - b.setNumber),
    })),
  };
  if (!isConsistent(file)) return { ok: false, error: 'INCONSISTENT_REFERENCES' };
  return { ok: true, file, summary: summarize(file) };
}

/* ------------------------------------------------------------------ apply */

/** Replace: the imported data becomes the whole app data. */
export function replaceData(incoming: TransferData): TransferData {
  return {
    profiles: [...incoming.profiles],
    teams: [...incoming.teams],
    players: [...incoming.players],
    matches: [...incoming.matches],
  };
}

/** Existing order is kept; an incoming item with an existing id replaces it in place; new ones are appended. */
function mergeById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const merged = existing.map((x) => byId.get(x.id) ?? x);
  const existingIds = new Set(existing.map((x) => x.id));
  return [...merged, ...incoming.filter((x) => !existingIds.has(x.id))];
}

export type MergeResult = { ok: true; data: TransferData } | { ok: false; error: 'MERGE_CONFLICT' };

/**
 * Merge: every profile, team, player and match is matched by id. **On an equal id the incoming
 * item wins** (it replaces the existing one in place); items only in `existing` are kept, items
 * only in `incoming` are appended. Nothing is deleted.
 *
 * If the combined data would be inconsistent (e.g. two different players with the same jersey
 * number in one team, or an id that belongs to a different team in each data set) the merge is refused with `MERGE_CONFLICT` (the user can choose
 * Replace instead); data is never silently dropped or renumbered.
 */
export function mergeData(existing: TransferData, incoming: TransferData): MergeResult {
  const data: TransferData = {
    profiles: mergeById(existing.profiles, incoming.profiles),
    teams: mergeById(existing.teams, incoming.teams),
    players: mergeById(existing.players, incoming.players),
    matches: mergeById(existing.matches, incoming.matches),
  };
  return isConsistent(data) ? { ok: true, data } : { ok: false, error: 'MERGE_CONFLICT' };
}
