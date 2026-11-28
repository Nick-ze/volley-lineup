/**
 * v12 hosted tournaments as stored and exported: the three collections, their consistency
 * rules, and how an import replaces or merges them. They never take part in cloud sync, so
 * they are kept apart from the team data (`TransferData`).
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { runningPoints, scoreOf, tagSide } from './hostedLive';
import { pairKey } from './hostedPlan';
import { MAX_HOSTED_PLAYER_NUMBER } from './hostedPlayers';
import { bestOfAllowed, nextSetAllowed, resultValidity } from './hostedResult';
import type { ExportFile, HostedPlayer, HostedResult, HostedTournament } from './types';

/** The hosted-tournament collections (store `AppData` and export file). */
export type HostedData = Pick<
  ExportFile,
  'hostedTournaments' | 'hostedTeams' | 'hostedResults' | 'hostedPlayers'
>;

export const emptyHosted = (): HostedData => ({
  hostedTournaments: [],
  hostedTeams: [],
  hostedResults: [],
  hostedPlayers: [],
});

/** The three collections of anything that has them (missing ones are empty). */
export const hostedOf = (data: Partial<HostedData>): HostedData => ({
  hostedTournaments: data.hostedTournaments ?? [],
  hostedTeams: data.hostedTeams ?? [],
  hostedResults: data.hostedResults ?? [],
  hostedPlayers: data.hostedPlayers ?? [],
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
 * - v12.1, own matches: a result (a match) may have no sets yet, and a pair may have several;
 * - v12.2: every player's team exists and a player has a number (whole, 0–999) or a name; a
 *   result's live rallies fit its sets (`liveOk`) — a round robin's result may then consist of a
 *   running set only.
 */
export function isHostedConsistent(data: HostedData, profileIds: ReadonlySet<string>): boolean {
  const { hostedTournaments, hostedTeams, hostedResults, hostedPlayers } = data;
  const lists = [hostedTournaments, hostedTeams, hostedResults, hostedPlayers];
  if (!lists.every((l) => unique(l.map((x) => x.id)))) return false;
  const tournaments = new Map(hostedTournaments.map((x) => [x.id, x]));
  const settingsOk = hostedTournaments.every(
    (x) =>
      profileIds.has(x.profileId) && (x.matchEnd === 'allSets' || bestOfAllowed(x.setsPerMatch)),
  );
  if (!settingsOk) return false;
  if (!hostedTeams.every((team) => tournaments.has(team.tournamentId))) return false;
  const tournamentOfTeam = new Map(hostedTeams.map((team) => [team.id, team.tournamentId]));
  if (!hostedPlayers.every((p) => tournamentOfTeam.has(p.teamId) && playerOk(p))) return false;
  const teamOfPlayer = new Map(hostedPlayers.map((p) => [p.id, p.teamId]));
  const resultOk = (r: HostedResult): boolean => {
    const tournament = tournaments.get(r.tournamentId);
    if (tournament === undefined || r.teamAId === r.teamBId) return false;
    if (tournamentOfTeam.get(r.teamAId) !== r.tournamentId) return false;
    if (tournamentOfTeam.get(r.teamBId) !== r.tournamentId) return false;
    if (!liveOk(r, tournament, teamOfPlayer)) return false;
    if (r.sets.length === 0) {
      // A match the coach added may still be without a result; a round robin's result exists
      // without a finished set only while its first set is being scored live.
      return tournament.plan === 'manual' || r.live !== undefined;
    }
    return resultValidity(r.sets, tournament).ok;
  };
  if (!hostedResults.every(resultOk)) return false;
  const onePerPair = hostedResults.filter(
    (r) => tournaments.get(r.tournamentId)?.plan !== 'manual',
  );
  return unique(onePerPair.map((r) => pairKey(r.teamAId, r.teamBId)));
}

/** A player has a jersey number (whole, 0–999) or a name. */
function playerOk(player: HostedPlayer): boolean {
  const { number, name } = player;
  if (number === undefined) return name !== undefined && name.trim() !== '';
  return Number.isInteger(number) && number >= 0 && number <= MAX_HOSTED_PLAYER_NUMBER;
}

/**
 * v12.2: a result's live rallies fit its sets — one list per finished set (empty for a typed-in
 * score, otherwise adding up to exactly that score) and at most one more, non-empty, for a set
 * that may be played; a named player belongs to the side the tag is about.
 */
function liveOk(
  result: HostedResult,
  tournament: HostedTournament,
  teamOfPlayer: ReadonlyMap<string, string>,
): boolean {
  const { live, sets } = result;
  if (live === undefined) return true;
  if (live.length < sets.length || live.length > sets.length + 1) return false;
  const running = runningPoints({ sets, live });
  if (running !== null && (running.length === 0 || !nextSetAllowed(sets, tournament))) return false;
  if (live.every((points) => points.length === 0)) return false;
  const scoresFit = sets.every((set, i) => {
    const score = scoreOf(live[i]);
    return live[i].length === 0 || (score.a === set.a && score.b === set.b);
  });
  if (!scoresFit) return false;
  return live.flat().every((point) => {
    if (point.playerId === undefined) return true;
    if (point.kind === undefined) return false;
    const teamId = tagSide(point, point.kind) === 'a' ? result.teamAId : result.teamBId;
    return teamOfPlayer.get(point.playerId) === teamId;
  });
}

/** The tournaments matching `keep`, with their teams, their teams' players, and results. */
function keepTournaments(data: HostedData, keep: (tournamentId: string) => boolean): HostedData {
  const hostedTeams = data.hostedTeams.filter((x) => keep(x.tournamentId));
  const teamIds = new Set(hostedTeams.map((x) => x.id));
  return {
    hostedTournaments: data.hostedTournaments.filter((x) => keep(x.id)),
    hostedTeams,
    hostedResults: data.hostedResults.filter((x) => keep(x.tournamentId)),
    hostedPlayers: data.hostedPlayers.filter((p) => teamIds.has(p.teamId)),
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

/** Without one team, its players and every result it is part of. */
export function withoutHostedTeam(data: HostedData, teamId: string): HostedData {
  return {
    hostedTournaments: data.hostedTournaments,
    hostedTeams: data.hostedTeams.filter((x) => x.id !== teamId),
    hostedResults: data.hostedResults.filter((r) => r.teamAId !== teamId && r.teamBId !== teamId),
    hostedPlayers: data.hostedPlayers.filter((p) => p.teamId !== teamId),
  };
}

/**
 * v12.2: without one player. Rallies that named them keep how the point was won and lose the
 * name (results whose rallies don't name them are kept as they are).
 */
export function withoutHostedPlayer(data: HostedData, playerId: string): HostedData {
  const strip = (r: HostedResult): HostedResult => {
    if (!r.live?.some((points) => points.some((p) => p.playerId === playerId))) return r;
    const live = r.live.map((points) =>
      points.map((p) => {
        if (p.playerId !== playerId) return p;
        const { playerId: _gone, ...rest } = p;
        return rest;
      }),
    );
    return { ...r, live };
  };
  return {
    hostedTournaments: data.hostedTournaments,
    hostedTeams: data.hostedTeams,
    hostedResults: data.hostedResults.map(strip),
    hostedPlayers: data.hostedPlayers.filter((p) => p.id !== playerId),
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
      hostedPlayers: mergeById(current.hostedPlayers, file.hostedPlayers),
    },
    profileIds,
  );
  return isHostedConsistent(merged, profileIds)
    ? { ok: true, hosted: merged }
    : { ok: false, error: 'MERGE_CONFLICT' };
}
