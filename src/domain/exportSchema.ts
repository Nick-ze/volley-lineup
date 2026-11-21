/**
 * Export / import file format (docs/PLAN.md §3.8, §6 `ExportFile`).
 *
 * Pure functions only: building an export, parsing + validating an import, and turning an
 * import into new app data (merge or replace). No React, no storage, no user-facing text —
 * errors are returned as codes that the UI maps to strings.
 */
import { z } from 'zod';

import type {
  ExportFile,
  FormationOrder,
  FormationSystem,
  LineupPreset,
  ManagerProfile,
  Match,
  Player,
  PointKind,
  Position,
  SetEvent,
  SetLineup,
  Team,
} from './types';
import { isValidPointTag } from './pointTags';
import { FORMATION_ORDERS, FORMATION_SYSTEMS, upgradeLineupToFormation } from './roles';
import { validatePresetName } from './presets';
import { ALL_POSITIONS } from './types';

export const EXPORT_APP_ID = 'volley-lineup' as const;
export const EXPORT_SCHEMA_VERSION = 6 as const;
/** Older file versions that `parseImport` still accepts (upgraded on the fly). */
export const SUPPORTED_IMPORT_VERSIONS: readonly number[] = [1, 2, 3, 4, 5, 6];

/**
 * The five persisted collections. Derived from `ExportFile` (the domain layer can't import the
 * store); it is structurally identical to the store's `AppData`.
 */
export type TransferData = Pick<
  ExportFile,
  'profiles' | 'teams' | 'players' | 'matches' | 'presets'
>;

/* ------------------------------------------------------------------ schema */

const id = z.string().min(1);
const playerRef = id.nullable();

const positionSchema = z.enum(ALL_POSITIONS as [Position, ...Position[]]);

const POINT_KINDS = [
  'kill',
  'ace',
  'block',
  'opponentError',
  'ourError',
  'opponentKill',
  'opponentAce',
] as const satisfies readonly PointKind[];

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

const slotsSchema = z.object({
  1: playerRef,
  2: playerRef,
  3: playerRef,
  4: playerRef,
  5: playerRef,
  6: playerRef,
});

/** v5: player id → role. */
const formationSchema = z.object({
  system: z.enum(FORMATION_SYSTEMS as [FormationSystem, ...FormationSystem[]]),
  order: z.enum(FORMATION_ORDERS as [FormationOrder, ...FormationOrder[]]),
  setterAt: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
});

const setLineupSchema = z.object({
  setNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  slots: slotsSchema,
  liberoId: playerRef,
  weServeFirst: z.boolean(),
  liberoReplaces: z.array(id),
  events: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('point'),
        winner: z.enum(['us', 'them']),
        kind: z.enum(POINT_KINDS).optional(),
        playerId: id.optional(),
        at: z.string().optional(),
      }),
      z.object({ type: z.literal('sub'), outPlayerId: id, inPlayerId: id }),
    ]),
  ),
  formation: formationSchema,
  liberoActive: z.boolean(),
});

const matchSchema = z.object({
  id,
  teamId: id,
  opponent: z.string(),
  date: z.string(),
  home: z.boolean(),
  sets: z.array(setLineupSchema).min(1).max(5),
});

const presetSchema = z.object({
  id,
  teamId: id,
  name: z.string(),
  kind: z.enum(['starters', 'preset']),
  slots: slotsSchema,
  liberoId: playerRef,
  liberoReplaces: z.array(id),
  formation: formationSchema,
  liberoActive: z.boolean(),
  createdAt: z.string(),
});

export const exportFileSchema = z.object({
  app: z.literal(EXPORT_APP_ID),
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: z.string(),
  profiles: z.array(profileSchema),
  teams: z.array(teamSchema),
  players: z.array(playerSchema),
  matches: z.array(matchSchema),
  presets: z.array(presetSchema),
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
  Assert<Same<z.infer<typeof setLineupSchema>['events'][number], SetEvent>>,
  Assert<Same<z.infer<typeof matchSchema>, Match>>,
  Assert<Same<z.infer<typeof presetSchema>, LineupPreset>>,
  Assert<Same<z.infer<typeof exportFileSchema>, ExportFile>>,
];

/* ------------------------------------------------------------------ export */

export interface BuildExportOptions {
  /** Export only this team (plus its owning profile, players, matches and presets). */
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
      presets: [...data.presets],
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
    presets: data.presets.filter((p) => p.teamId === teamId),
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
  presets: number;
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
 * - within a set, no player is in two slots and the libero is not also a starter;
 * - point tags (v4) are coherent (a kind of the winning side, a player only where the kind takes
 *   one) and a tagged player belongs to the match's team;
 * - presets (v3) follow the same lineup rules for their team, and a team has at most one
 *   'starters' preset; named presets have a valid name (≤ 40 characters, not blank) that is
 *   unique within the team, ignoring case.
 */
export function isConsistent(data: TransferData): boolean {
  const { profiles, teams, players, matches, presets } = data;
  const lists = [profiles, teams, players, matches, presets];
  if (lists.some((list) => hasDuplicates(list.map((x) => x.id)))) return false;
  const profileIds = new Set(profiles.map((p) => p.id));
  const teamIds = new Set(teams.map((t) => t.id));
  if (!teams.every((t) => profileIds.has(t.profileId))) return false;
  if (!players.every((p) => teamIds.has(p.teamId))) return false;
  if (!matches.every((m) => teamIds.has(m.teamId))) return false;
  if (!presets.every((p) => teamIds.has(p.teamId))) return false;
  if (hasDuplicates(presets.filter((p) => p.kind === 'starters').map((p) => p.teamId))) {
    return false;
  }

  const teamOfPlayer = new Map(players.map((p) => [p.id, p.teamId]));
  for (const teamId of teamIds) {
    const numbers = players.filter((p) => p.teamId === teamId).map((p) => p.number);
    if (hasDuplicates(numbers)) return false;
  }
  /** A lineup (set or preset) of `teamId`: nobody twice, libero not on court, own players only. */
  const lineupOk = (
    teamId: string,
    lineup: Pick<SetLineup, 'slots' | 'liberoId' | 'liberoReplaces'>,
    extraPlayers: readonly string[] = [],
  ): boolean => {
    const starters = Object.values(lineup.slots).filter((x): x is string => x !== null);
    if (hasDuplicates(starters)) return false; // a player in two slots
    if (lineup.liberoId !== null && starters.includes(lineup.liberoId)) return false;
    return [...starters, lineup.liberoId, ...lineup.liberoReplaces, ...extraPlayers].every(
      (playerId) => playerId === null || teamOfPlayer.get(playerId) === teamId,
    );
  };
  if (!presets.every((p) => lineupOk(p.teamId, p))) return false;
  const namesOk = presets.every(
    (p) => p.kind === 'starters' || validatePresetName(p.name, presets, p.teamId, p.id).ok,
  );
  if (!namesOk) return false;
  return matches.every((m) => {
    if (hasDuplicates(m.sets.map((s) => s.setNumber))) return false;
    return m.sets.every((set) => {
      if (!set.events.every((e) => e.type === 'sub' || isValidPointTag(e))) return false;
      const eventPlayers = set.events.flatMap((e) =>
        e.type === 'sub'
          ? [e.outPlayerId, e.inPlayerId]
          : e.playerId === undefined
            ? []
            : [e.playerId],
      );
      return lineupOk(m.teamId, set, eventPlayers);
    });
  });
}

/**
 * v1 → v2: sets gain `liberoReplaces: []` and `events: []`. Anything malformed is passed through
 * untouched so the zod check reports it as INVALID_SHAPE.
 */
function upgradeV1(raw: Record<string, unknown>): Record<string, unknown> {
  const matches = Array.isArray(raw.matches)
    ? raw.matches.map((m: unknown) =>
        isRecord(m) && Array.isArray(m.sets)
          ? {
              ...m,
              sets: m.sets.map((set: unknown) =>
                isRecord(set) ? { liberoReplaces: [], events: [], ...set } : set,
              ),
            }
          : m,
      )
    : raw.matches;
  return { ...raw, schemaVersion: 2, matches };
}

/** v4 → v5: every set and preset gains `roles: {}` (primary positions) and `liberoActive: true`. */
function upgradeV4(raw: Record<string, unknown>): Record<string, unknown> {
  const lineupDefaults = (x: unknown) =>
    isRecord(x) ? { roles: {}, liberoActive: true, ...x } : x;
  const matches = Array.isArray(raw.matches)
    ? raw.matches.map((m: unknown) =>
        isRecord(m) && Array.isArray(m.sets) ? { ...m, sets: m.sets.map(lineupDefaults) } : m,
      )
    : raw.matches;
  const presets = Array.isArray(raw.presets) ? raw.presets.map(lineupDefaults) : raw.presets;
  return { ...raw, schemaVersion: 5, matches, presets };
}

/** v5 → v6: per-player role overrides become a formation per set and preset (roles.ts). */
function upgradeV5(raw: Record<string, unknown>): Record<string, unknown> {
  const toFormation = (x: unknown) => upgradeLineupToFormation(x, raw.players);
  const matches = Array.isArray(raw.matches)
    ? raw.matches.map((m: unknown) =>
        isRecord(m) && Array.isArray(m.sets) ? { ...m, sets: m.sets.map(toFormation) } : m,
      )
    : raw.matches;
  const presets = Array.isArray(raw.presets) ? raw.presets.map(toFormation) : raw.presets;
  return { ...raw, schemaVersion: 6, matches, presets };
}

/**
 * Upgrades an older file step by step: v1 → v2 (sets), v2 → v3 (`presets: []`), v3 → v4 (no data
 * change: untagged points without timestamps stay valid), v4 → v5 (roles + libero on/off),
 * v5 → v6 (roles become a formation per lineup).
 */
function upgradeToCurrent(raw: Record<string, unknown>): Record<string, unknown> {
  const v2 = raw.schemaVersion === 1 ? upgradeV1(raw) : raw;
  const v3 = v2.schemaVersion === 2 ? { presets: [], ...v2, schemaVersion: 3 } : v2;
  const v4 = v3.schemaVersion === 3 ? { ...v3, schemaVersion: 4 } : v3;
  const v5 = v4.schemaVersion === 4 ? upgradeV4(v4) : v4;
  return v5.schemaVersion === 5 ? upgradeV5(v5) : v5;
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
    presets: [...incoming.presets],
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
 * Merge: every profile, team, player, match and preset is matched by id. **On an equal id the
 * incoming item wins** (it replaces the existing one in place); items only in `existing` are
 * kept, items only in `incoming` are appended.
 *
 * The one deletion: a team has a single starters preset, so when the file has starters for a
 * team, they replace that team's existing starters (even under a different id). Nothing else is
 * deleted.
 *
 * If the combined data would be inconsistent (e.g. two different players with the same jersey
 * number in one team, an id that belongs to a different team in each data set, or two presets
 * of a team with the same name) the merge is refused with `MERGE_CONFLICT` (the user can choose
 * Replace instead); data is never silently dropped or renumbered.
 */
export function mergeData(existing: TransferData, incoming: TransferData): MergeResult {
  // A team has one set of starters: incoming starters replace the existing ones of that team.
  const incomingStarters = new Map(
    incoming.presets.filter((p) => p.kind === 'starters').map((p) => [p.teamId, p.id]),
  );
  const keptPresets = existing.presets.filter(
    (p) => p.kind !== 'starters' || (incomingStarters.get(p.teamId) ?? p.id) === p.id,
  );
  const data: TransferData = {
    profiles: mergeById(existing.profiles, incoming.profiles),
    teams: mergeById(existing.teams, incoming.teams),
    players: mergeById(existing.players, incoming.players),
    matches: mergeById(existing.matches, incoming.matches),
    presets: mergeById(keptPresets, incoming.presets),
  };
  return isConsistent(data) ? { ok: true, data } : { ok: false, error: 'MERGE_CONFLICT' };
}
