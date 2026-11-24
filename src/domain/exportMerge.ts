/**
 * Applying an import: replace all data, or merge it into the existing data.
 *
 * Sub-module of the `exportSchema.ts` barrel: import siblings directly, never the barrel.
 */
import { withValidCaptain } from './captain';
import { isConsistent } from './exportConsistency';
import type { TransferData } from './exportFormat';
import { keepReferencedPhotos } from './photos';
import { alignIncomingByName } from './seasonMerge';
import type { Player, Team } from './types';

/** Replace: the imported data becomes the whole app data. */
export function replaceData(incoming: TransferData): TransferData {
  return {
    profiles: [...incoming.profiles],
    teams: [...incoming.teams],
    players: [...incoming.players],
    matches: [...incoming.matches],
    presets: [...incoming.presets],
    photos: [...incoming.photos],
    seasons: [...incoming.seasons],
    opponents: [...incoming.opponents],
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
 * Merge: every profile, team, player, match, preset, season, opponent and photo is matched by
 * id. **On an equal id the incoming item wins** (it replaces the existing one in place); items
 * only in `existing` are kept, items only in `incoming` are appended.
 *
 * The one deletion: a team has a single starters preset, so when the file has starters for a
 * team, they replace that team's existing starters (even under a different id). Nothing else is
 * deleted.
 *
 * v7 (v8 file): an incoming season or opponent with the name of an existing one (same team /
 * season, ignoring case and accents) is matched to it first (`alignIncomingByName`).
 *
 * v7: a merge never deletes a picture or a description. An incoming player (or profile, or v9 team) without
 * a `photoId` keeps the existing one's photo, and an incoming player without a description (a
 * file exported without descriptions, or from before v6) keeps the existing description; when
 * the file has one, it wins. Photos are merged by id; orphans are dropped.
 *
 * v10: an incoming team's captain wins. An incoming team without a captain (e.g. a file from
 * before v10) keeps the existing team's captain, as long as that player is still a player of the
 * team after the merge (otherwise the team has none).
 *
 * If the combined data would be inconsistent (e.g. two different players with the same jersey
 * number in one team, an id that belongs to a different team in each data set, or two presets
 * of a team with the same name) the merge is refused with `MERGE_CONFLICT` (the user can choose
 * Replace instead); data is never silently dropped or renumbered.
 */
export function mergeData(existing: TransferData, file: TransferData): MergeResult {
  // v7 QA: same-named seasons / opponents of another device become the existing ones.
  const incoming = alignIncomingByName(existing, file);
  // A team has one set of starters: incoming starters replace the existing ones of that team.
  const incomingStarters = new Map(
    incoming.presets.filter((p) => p.kind === 'starters').map((p) => [p.teamId, p.id]),
  );
  const keptPresets = existing.presets.filter(
    (p) => p.kind !== 'starters' || (incomingStarters.get(p.teamId) ?? p.id) === p.id,
  );
  const oldProfiles = new Map(existing.profiles.map((p) => [p.id, p]));
  const oldPlayers = new Map(existing.players.map((p) => [p.id, p]));
  const oldTeams = new Map(existing.teams.map((t) => [t.id, t]));
  const profiles = mergeById(
    existing.profiles,
    incoming.profiles.map((p) => keepPhoto(p, oldProfiles.get(p.id))),
  );
  const players = mergeById(
    existing.players,
    incoming.players.map((p) =>
      keepDescription(keepPhoto(p, oldPlayers.get(p.id)), oldPlayers.get(p.id)),
    ),
  );
  const teams = mergeById(
    existing.teams,
    incoming.teams.map((t) =>
      keepCaptain(keepPhoto(t, oldTeams.get(t.id)), oldTeams.get(t.id), players),
    ),
  );
  const data: TransferData = {
    profiles,
    teams,
    players,
    matches: mergeById(existing.matches, incoming.matches),
    presets: mergeById(keptPresets, incoming.presets),
    photos: keepReferencedPhotos(mergeById(existing.photos, incoming.photos), {
      profiles,
      players,
      teams,
    }),
    seasons: mergeById(existing.seasons, incoming.seasons),
    opponents: mergeById(existing.opponents, incoming.opponents),
  };
  return isConsistent(data) ? { ok: true, data } : { ok: false, error: 'MERGE_CONFLICT' };
}

/** v7 merge: the incoming item, keeping the existing photo when the incoming one has none. */
function keepPhoto<T extends { photoId?: string }>(incoming: T, old: T | undefined): T {
  return incoming.photoId === undefined && old?.photoId !== undefined
    ? { ...incoming, photoId: old.photoId }
    : incoming;
}

/**
 * v10 merge: the incoming team, keeping the existing captain when the incoming team has none and
 * that player is still one of the team's `players` (the merged players).
 */
function keepCaptain(incoming: Team, old: Team | undefined, players: readonly Player[]): Team {
  if (incoming.captainId !== undefined || old?.captainId === undefined) return incoming;
  return withValidCaptain({ ...incoming, captainId: old.captainId }, players);
}

/** v7 merge: the incoming player, keeping the existing description when the file has none. */
function keepDescription(incoming: Player, old: Player | undefined): Player {
  return incoming.description === undefined && old?.description !== undefined
    ? { ...incoming, description: old.description }
    : incoming;
}
