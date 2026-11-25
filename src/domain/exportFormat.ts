/**
 * Export file format (docs/PLAN.md §3.8, §6 `ExportFile`): the app id, the schema version, the
 * zod schemas of the current version and the compile-time check that they match ./types.ts.
 *
 * Sub-module of the `exportSchema.ts` barrel: import siblings directly, never the barrel.
 */
import { z } from 'zod';

import type {
  ExportFile,
  LineupPreset,
  ManagerProfile,
  Match,
  Opponent,
  Photo,
  Player,
  Season,
  SetEvent,
  SetLineup,
  Team,
} from './types';
import { FORMATION_ORDERS, FORMATION_SYSTEMS } from './roles';
import { SEASON_KINDS } from './seasonNames';
import { isPhotoDataUri, isValidDescription } from './photos';
import { ALL_POSITIONS, ERROR_TYPES, POINT_KINDS } from './types';

export const EXPORT_APP_ID = 'volley-lineup' as const;
export const EXPORT_SCHEMA_VERSION = 10 as const;
/** Older file versions that `parseImport` still accepts (upgraded on the fly). */
export const SUPPORTED_IMPORT_VERSIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * The persisted collections. Derived from `ExportFile` (the domain layer can't import the
 * store): the store's `AppData` plus (v7) the photos, which live in their own storage.
 */
export type TransferData = Pick<
  ExportFile,
  'profiles' | 'teams' | 'players' | 'matches' | 'presets' | 'photos' | 'seasons' | 'opponents'
>;

/* ------------------------------------------------------------------ schema */

const id = z.string().min(1);
const playerRef = id.nullable();

const positionSchema = z.enum(ALL_POSITIONS);

const profileSchema = z.object({
  id,
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
  photoId: id.optional(),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const teamSchema = z.object({
  id,
  profileId: id,
  name: z.string(),
  season: z.string().optional(),
  createdAt: z.string(),
  photoId: id.optional(),
  /** v10: the team captain (a player of this team). */
  captainId: id.optional(),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const playerSchema = z.object({
  id,
  teamId: id,
  firstName: z.string(),
  lastName: z.string(),
  number: z.number().int().nonnegative(),
  positions: z.array(positionSchema).min(1),
  active: z.boolean(),
  photoId: id.optional(),
  description: z.string().refine(isValidDescription).optional(),
});

/** v7: a picture referenced by a profile or player. */
/** v10: also used to validate synced records (`syncSchema.ts`). */
export const photoSchema = z.object({
  id,
  dataUri: z.string().refine(isPhotoDataUri),
});

const slotsSchema = z.object({
  1: playerRef,
  2: playerRef,
  3: playerRef,
  4: playerRef,
  5: playerRef,
  6: playerRef,
});

/** v6: the formation of a set / preset (roles.ts). */
const formationSchema = z.object({
  system: z.enum(FORMATION_SYSTEMS),
  order: z.enum(FORMATION_ORDERS),
  setterAt: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const setLineupSchema = z.object({
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
        errorType: z.enum(ERROR_TYPES).optional(),
        at: z.string().optional(),
      }),
      z.object({ type: z.literal('sub'), outPlayerId: id, inPlayerId: id }),
    ]),
  ),
  formation: formationSchema,
  liberoActive: z.boolean(),
});

/** v8: a season / tournament and an opponent team. */
/** v10: also used to validate synced records (`syncSchema.ts`). */
export const seasonSchema = z.object({
  id,
  teamId: id,
  name: z.string(),
  kind: z.enum(SEASON_KINDS),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  createdAt: z.string(),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const opponentSchema = z.object({
  id,
  seasonId: id,
  name: z.string(),
  createdAt: z.string(),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const matchSchema = z.object({
  id,
  teamId: id,
  seasonId: id,
  opponentId: id,
  opponent: z.string(),
  date: z.string(),
  home: z.boolean(),
  sets: z.array(setLineupSchema).min(1).max(5),
});

/** v10: also used to validate synced records (`syncSchema.ts`). */
export const presetSchema = z.object({
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
  photos: z.array(photoSchema),
  seasons: z.array(seasonSchema),
  opponents: z.array(opponentSchema),
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
  Assert<Same<z.infer<typeof photoSchema>, Photo>>,
  Assert<Same<z.infer<typeof seasonSchema>, Season>>,
  Assert<Same<z.infer<typeof opponentSchema>, Opponent>>,
  Assert<Same<z.infer<typeof exportFileSchema>, ExportFile>>,
];
