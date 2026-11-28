/**
 * v12 hosted tournaments as stored and exported: the three collections, their consistency
 * rules, and how an import replaces or merges them. They never take part in cloud sync, so
 * they are kept apart from the team data (`TransferData`).
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { pairKey } from './hostedPlan';
import { bestOfAllowed, resultValidity } from './hostedResult';
import type { ExportFile, HostedResult } from './types';

/** The hosted-tournament collections (store `AppData` and export file). */
export type HostedData = Pick<ExportFile, 'hostedTournaments' | 'hostedTeams' | 'hostedResults'>;

export const emptyHosted = (): HostedData => ({
  hostedTournaments: [],
  hostedTeams: [],
  hostedResults: [],
});

/** The three collections of anything that has them (missing ones are empty). */
export const hostedOf = (data: Partial<HostedData>): HostedData => ({
  hostedTournaments: data.hostedTournaments ?? [],
  hostedTeams: data.hostedTeams ?? [],
  hostedResults: data.hostedResults ?? [],
});

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

/**
 * True when the hosted tournaments are internally consistent:
 * - ids are unique within each collection;
 * - every tournament's profile exists, and "best of" only goes with 1, 3 or 5 sets;
 * - every team's tournament exists;
 * - every result's tournament exists and its two teams are different teams of that tournament;
 * - every result is valid under its tournament's settings (`resultValidity`);
 * - round robin: a result has at least one set and there is one result per pair of teams;
 * - v12.1, own matches: a result (a match) may have no sets yet, and a pair may have several.
 */
export function isHostedConsistent(data: HostedData, profileIds: ReadonlySet<string>): boolean {
  const { hostedTournaments, hostedTeams, hostedResults } = data;
  if (![hostedTournaments, hostedTeams, hostedResults].every((l) => unique(l.map((x) => x.id)))) {
    return false;
  }
  const tournaments = new Map(hostedTournaments.map((x) => [x.id, x]));
  const settingsOk = hostedTournaments.every(
    (x) =>
      profileIds.has(x.profileId) && (x.matchEnd === 'allSets' || bestOfAllowed(x.setsPerMatch)),
  );
  if (!settingsOk) return false;
  if (!hostedTeams.every((team) => tournaments.has(team.tournamentId))) return false;
  const tournamentOfTeam = new Map(hostedTeams.map((team) => [team.id, team.tournamentId]));
  const resultOk = (r: HostedResult): boolean => {
    const tournament = tournaments.get(r.tournamentId);
    if (tournament === undefined || r.teamAId === r.teamBId) return false;
    if (tournamentOfTeam.get(r.teamAId) !== r.tournamentId) return false;
    if (tournamentOfTeam.get(r.teamBId) !== r.tournamentId) return false;
    // A match the coach added may still be without a result.
    if (tournament.plan === 'manual' && r.sets.length === 0) return true;
    return resultValidity(r.sets, tournament).ok;
  };
  if (!hostedResults.every(resultOk)) return false;
  const onePerPair = hostedResults.filter(
    (r) => tournaments.get(r.tournamentId)?.plan !== 'manual',
  );
  return unique(onePerPair.map((r) => pairKey(r.teamAId, r.teamBId)));
}

/** The tournaments matching `keep`, with their teams and results. */
function keepTournaments(data: HostedData, keep: (tournamentId: string) => boolean): HostedData {
  return {
    hostedTournaments: data.hostedTournaments.filter((x) => keep(x.id)),
    hostedTeams: data.hostedTeams.filter((x) => keep(x.tournamentId)),
    hostedResults: data.hostedResults.filter((x) => keep(x.tournamentId)),
  };
}

/** Only the tournaments of these profiles (a deleted profile takes its tournaments along). */
export function hostedOfProfiles(data: HostedData, profileIds: ReadonlySet<string>): HostedData {
  const kept = new Set(
    data.hostedTournaments.filter((x) => profileIds.has(x.profileId)).map((x) => x.id),
  );
  return keepTournaments(data, (id) => kept.has(id));
}

/** Without one tournament, its teams and its results. */
export const withoutHostedTournament = (data: HostedData, tournamentId: string): HostedData =>
  keepTournaments(data, (id) => id !== tournamentId);

/** Without one team and every result it is part of. */
export function withoutHostedTeam(data: HostedData, teamId: string): HostedData {
  return {
    hostedTournaments: data.hostedTournaments,
    hostedTeams: data.hostedTeams.filter((x) => x.id !== teamId),
    hostedResults: data.hostedResults.filter((r) => r.teamAId !== teamId && r.teamBId !== teamId),
  };
}

function mergeById<T extends { id: string }>(existing: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(incoming.map((x) => [x.id, x]));
  const existingIds = new Set(existing.map((x) => x.id));
  return [
    ...existing.map((x) => byId.get(x.id) ?? x),
    ...incoming.filter((x) => !existingIds.has(x.id)),
  ];
}

export type HostedImportResult =
  { ok: true; hosted: HostedData } | { ok: false; error: 'MERGE_CONFLICT' };

/**
 * The hosted tournaments after an import.
 *
 * - Replace: the file's tournaments become all there is.
 * - Merge: tournaments, teams and results are matched by id and the file's item wins; items only
 *   on the device stay, new ones are appended. In a round robin a pair of teams has one result,
 *   so the file's result for a pair replaces the device's (even under another id); the matches
 *   of a tournament with own matches (v12.1) are only matched by id. If the combined data
 *   would be inconsistent (e.g. a kept result has more sets than the file's settings allow) the
 *   merge is refused with `MERGE_CONFLICT`; nothing is dropped silently.
 *
 * Either way only tournaments of the profiles the import leaves on the device are kept.
 */
export function importHosted(
  current: HostedData,
  file: HostedData,
  mode: 'merge' | 'replace',
  profileIds: ReadonlySet<string>,
): HostedImportResult {
  if (mode === 'replace') return { ok: true, hosted: hostedOfProfiles(file, profileIds) };
  const hostedTournaments = mergeById(current.hostedTournaments, file.hostedTournaments);
  const manual = new Set(hostedTournaments.filter((x) => x.plan === 'manual').map((x) => x.id));
  const incomingPairs = new Map(
    file.hostedResults.map((r) => [pairKey(r.teamAId, r.teamBId), r.id]),
  );
  const keptResults = current.hostedResults.filter(
    (r) =>
      manual.has(r.tournamentId) ||
      (incomingPairs.get(pairKey(r.teamAId, r.teamBId)) ?? r.id) === r.id,
  );
  const merged = hostedOfProfiles(
    {
      hostedTournaments,
      hostedTeams: mergeById(current.hostedTeams, file.hostedTeams),
      hostedResults: mergeById(keptResults, file.hostedResults),
    },
    profileIds,
  );
  return isHostedConsistent(merged, profileIds)
    ? { ok: true, hosted: merged }
    : { ok: false, error: 'MERGE_CONFLICT' };
}
