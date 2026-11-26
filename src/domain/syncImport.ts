/**
 * v10: importing a file while some teams are shared through the cloud (docs/V10_SYNC_DESIGN.md
 * §3.12). Pure.
 *
 * - A shared team is never removed or replaced wholesale, in either mode, and keeps its owning
 *   profile — so Replace can never wipe (and then sync the deletion of) a shared team.
 * - The file's copy of a shared team:
 *   - managers: merged with Merge semantics (the file wins per id, nothing is deleted); the
 *     changes then sync to every member as normal edits;
 *   - viewers (player role): skipped and reported (they may not change the team).
 * - Everything else follows Replace / Merge exactly as without shared teams; with no shared
 *   team the result is exactly `replaceData` / `mergeData`.
 */
import type { TransferData } from './exportFormat';
import { mergeData, replaceData } from './exportMerge';
import { referencedPhotoIds } from './photos';
import { stableStringify } from './syncRecords';
import type { Match, Photo, SyncData, Team } from './types';

/** A team shared on this device and whether this device may edit it (manager). */
export interface SharedTeam {
  teamId: string;
  canEdit: boolean;
}

/**
 * `SHARED_CONFLICT`: a Merge would move records out of a shared team (audit H9) — nothing may
 * be changed then.
 */
export type SyncImportResult =
  | { ok: true; data: TransferData; skippedTeams: string[] }
  | { ok: false; error: 'MERGE_CONFLICT' | 'SHARED_CONFLICT' };

/**
 * The shared teams of the sync state that are on the device, with edit rights (managers edit,
 * players view). A link whose team isn't on the device protects nothing (audit C1): the file's
 * team with that id is an ordinary team for the import.
 */
export function sharedTeamsOf(
  teams: SyncData['teams'],
  teamsOnDevice: readonly { id: string }[],
): SharedTeam[] {
  const here = new Set(teamsOnDevice.map((t) => t.id));
  return Object.entries(teams)
    .filter(([teamId]) => here.has(teamId))
    .map(([teamId, linked]) => ({ teamId, canEdit: linked.role === 'manager' }));
}

/** For the import preview: the file's shared teams that will be merged / skipped. */
export function sharedTeamsInFile(
  file: Pick<TransferData, 'teams'>,
  shared: readonly SharedTeam[],
): { merged: Team[]; skipped: Team[] } {
  const canEdit = new Map(shared.map((s) => [s.teamId, s.canEdit]));
  return {
    merged: file.teams.filter((t) => canEdit.get(t.id) === true),
    skipped: file.teams.filter((t) => canEdit.get(t.id) === false),
  };
}

/**
 * True when the import's result changes or drops one of the matches `ids` (v10 audit M15, found
 * by the review) — matches another device is scoring live right now. The file's copy would
 * replace the scorer's rallies on this device, and from here for everyone.
 */
export function importChangesMatches(
  current: readonly Match[],
  result: readonly Match[],
  ids: readonly string[],
): boolean {
  if (ids.length === 0) return false;
  const after = new Map(result.map((m) => [m.id, m]));
  return current.some((m) => {
    if (!ids.includes(m.id)) return false;
    const next = after.get(m.id);
    return next === undefined || (next !== m && stableStringify(next) !== stableStringify(m));
  });
}

export function importWithSharedTeams(
  current: TransferData,
  file: TransferData,
  mode: 'merge' | 'replace',
  shared: readonly SharedTeam[],
): SyncImportResult {
  if (shared.length === 0) {
    if (mode === 'replace') return { ok: true, data: replaceData(file), skippedTeams: [] };
    const merged = mergeData(current, file);
    return merged.ok ? { ...merged, skippedTeams: [] } : merged;
  }
  const sharedIds = new Set(shared.map((s) => s.teamId));
  const viewerIds = new Set(shared.filter((s) => !s.canEdit).map((s) => s.teamId));
  const skippedTeams = file.teams.filter((t) => viewerIds.has(t.id)).map((t) => t.id);
  // Viewer teams in the file are dropped first; managers' shared teams stay to be merged.
  const incoming = withoutTeams(file, viewerIds);
  // A shared team's picture that hasn't been downloaded yet (v10 audit L31) stands in as an
  // empty photo while the result is checked, and is taken out again afterwards. Not for a
  // picture the file brings: the real one must win (on a view-only device nothing else of the
  // file's copy of that team is taken, and the stand-in would push the picture out).
  const inFile = new Set(incoming.photos.map((p) => p.id));
  const waiting = waitingPhotos(current, sharedIds).filter((p) => !inFile.has(p.id));
  const device =
    waiting.length > 0 ? { ...current, photos: [...current.photos, ...waiting] } : current;
  if (mode === 'merge' && movesSharedRecords(device, incoming, sharedIds)) {
    return { ok: false, error: 'SHARED_CONFLICT' };
  }
  const result =
    mode === 'merge'
      ? mergeData(device, incoming)
      : replaceKeepingShared(device, incoming, sharedIds);
  if (!result.ok) return result;
  const stand = new Set<unknown>(waiting);
  const data =
    waiting.length > 0
      ? { ...result.data, photos: result.data.photos.filter((p) => !stand.has(p)) }
      : result.data;
  return { ok: true, data: keepOwners(data, current, sharedIds), skippedTeams };
}

/**
 * Stand-ins for the photos that shared teams and their players refer to but the device doesn't
 * have (v10 audit L31): a cloud picture keeps its `photoId` while its download is still to come
 * (DECISIONS #294), and the import's consistency check ("every referenced photo is there") would
 * refuse every file because of it — Merge as a "conflict", Replace outright. The same photo in
 * the file replaces its stand-in (the file wins per id), so an import can also bring it back.
 */
function waitingPhotos(current: TransferData, sharedIds: ReadonlySet<string>): Photo[] {
  const have = new Set(current.photos.map((p) => p.id));
  const ids = new Set<string>();
  for (const team of current.teams) {
    if (sharedIds.has(team.id) && team.photoId !== undefined) ids.add(team.photoId);
  }
  for (const player of current.players) {
    if (sharedIds.has(player.teamId) && player.photoId !== undefined) ids.add(player.photoId);
  }
  return [...ids].filter((id) => !have.has(id)).map((id) => ({ id, dataUri: '' }));
}

/** Every record of the data that belongs to a team, as [`kind:id`, team id]. */
function recordTeams(data: TransferData): [string, string][] {
  const seasonTeam = new Map(data.seasons.map((x) => [x.id, x.teamId]));
  const pair = (kind: string, id: string, teamId: string): [string, string] => [
    `${kind}:${id}`,
    teamId,
  ];
  return [
    ...data.players.map((p) => pair('player', p.id, p.teamId)),
    ...data.seasons.map((x) => pair('season', x.id, x.teamId)),
    ...data.opponents.map((o) => pair('opponent', o.id, seasonTeam.get(o.seasonId) ?? '')),
    ...data.matches.map((m) => pair('match', m.id, m.teamId)),
    ...data.presets.map((p) => pair('preset', p.id, p.teamId)),
  ];
}

/**
 * True when the file holds a record of a shared team (the same id) under another team. A Merge
 * lets the file win per record id, so such a record would move to the file's team: the shared
 * team loses it on this device, and a manager device then deletes it for every member (audit
 * H9). It happens with a backup from before the team got a new id on upload (`rekeyTeam` keeps
 * the ids of players, seasons, matches and presets), or a co-coach's export of the same team.
 */
function movesSharedRecords(
  current: TransferData,
  incoming: TransferData,
  sharedIds: ReadonlySet<string>,
): boolean {
  const owners = new Map(recordTeams(current).filter(([, teamId]) => sharedIds.has(teamId)));
  return recordTeams(incoming).some(([key, teamId]) => {
    const owner = owners.get(key);
    return owner !== undefined && owner !== teamId;
  });
}

/**
 * Replace for everything but the shared teams: the file without its shared teams replaces the
 * data, the device's shared teams (with their profile when the file doesn't have it) are kept,
 * and then the file's copies of the managers' shared teams are merged in.
 */
function replaceKeepingShared(
  current: TransferData,
  incoming: TransferData,
  sharedIds: ReadonlySet<string>,
) {
  const kept = onlyTeams(current, sharedIds);
  const fileProfiles = new Set(incoming.profiles.map((p) => p.id));
  const keptSlice = { ...kept, profiles: kept.profiles.filter((p) => !fileProfiles.has(p.id)) };
  const base = mergeData(replaceData(withoutTeams(incoming, sharedIds)), keptSlice);
  return base.ok ? mergeData(base.data, onlyTeams(incoming, sharedIds)) : base;
}

/** The data of these teams only (with their owning profiles and the photos they refer to). */
function onlyTeams(data: TransferData, ids: ReadonlySet<string>): TransferData {
  return pick(data, (teamId) => ids.has(teamId));
}

/** The data without these teams (and everything that belongs to them). */
function withoutTeams(data: TransferData, ids: ReadonlySet<string>): TransferData {
  if (ids.size === 0) return data;
  const rest = pick(data, (teamId) => !ids.has(teamId));
  // Profiles and photos are not per team: keep them all (the merge drops unused photos).
  return { ...rest, profiles: data.profiles, photos: data.photos };
}

function pick(data: TransferData, keep: (teamId: string) => boolean): TransferData {
  const teams = data.teams.filter((t) => keep(t.id));
  const players = data.players.filter((p) => keep(p.teamId));
  const seasons = data.seasons.filter((x) => keep(x.teamId));
  const seasonIds = new Set(seasons.map((x) => x.id));
  const profileIds = new Set(teams.map((t) => t.profileId));
  const profiles = data.profiles.filter((p) => profileIds.has(p.id));
  const photoIds = referencedPhotoIds({ profiles, teams, players });
  return {
    profiles,
    teams,
    players,
    matches: data.matches.filter((m) => keep(m.teamId)),
    presets: data.presets.filter((p) => keep(p.teamId)),
    photos: data.photos.filter((p) => photoIds.has(p.id)),
    seasons,
    opponents: data.opponents.filter((o) => seasonIds.has(o.seasonId)),
  };
}

/** Shared teams keep the profile they belong to on this device (the file's may differ). */
function keepOwners(
  data: TransferData,
  current: TransferData,
  sharedIds: ReadonlySet<string>,
): TransferData {
  const owner = new Map(
    current.teams.filter((t) => sharedIds.has(t.id)).map((t) => [t.id, t.profileId]),
  );
  return {
    ...data,
    teams: data.teams.map((t) => {
      const profileId = owner.get(t.id);
      return profileId === undefined || profileId === t.profileId ? t : { ...t, profileId };
    }),
  };
}
