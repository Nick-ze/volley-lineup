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
import type { SyncData, Team } from './types';

/** A team shared on this device and whether this device may edit it (manager). */
export interface SharedTeam {
  teamId: string;
  canEdit: boolean;
}

export type SyncImportResult =
  { ok: true; data: TransferData; skippedTeams: string[] } | { ok: false; error: 'MERGE_CONFLICT' };

/** The shared teams of the sync state, with edit rights (managers edit, players view). */
export function sharedTeamsOf(teams: SyncData['teams']): SharedTeam[] {
  return Object.entries(teams).map(([teamId, linked]) => ({
    teamId,
    canEdit: linked.role === 'manager',
  }));
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
  const result =
    mode === 'merge'
      ? mergeData(current, incoming)
      : replaceKeepingShared(current, incoming, sharedIds);
  if (!result.ok) return result;
  return { ok: true, data: keepOwners(result.data, current, sharedIds), skippedTeams };
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
