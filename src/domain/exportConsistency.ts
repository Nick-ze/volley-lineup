/**
 * Cross-reference checks of export / import data (`isConsistent`): run on every import and
 * on the result of a merge.
 *
 * Sub-module of the `exportSchema.ts` barrel: import siblings directly, never the barrel.
 */
import type { TransferData } from './exportFormat';
import { isValidPointTag } from './pointTags';
import { referencedPhotoIds } from './photos';
import { validatePresetName } from './presets';
import { namesAreUnique } from './seasonMerge';
import type { Match, SetLineup } from './types';

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
 *   unique within the team, ignoring case;
 * - v7: every photo a profile, player or (v9) team refers to is in the file (photo ids unique); an error
 *   type only on an "our error" tag (`isValidPointTag`);
 * - v8: every season's team exists, every opponent's season exists, and every match is in a
 *   season of its own team and plays an opponent of that season; season names are unique
 *   within a team and opponent names within a season (ignoring case and accents).
 */
export function isConsistent(data: TransferData): boolean {
  const { profiles, teams, players, matches, presets, photos, seasons, opponents } = data;
  const lists = [profiles, teams, players, matches, presets, photos, seasons, opponents];
  if (lists.some((list) => hasDuplicates(list.map((x) => x.id)))) return false;
  const photoIds = new Set(photos.map((p) => p.id));
  if (![...referencedPhotoIds(data)].every((photoId) => photoIds.has(photoId))) return false;
  const profileIds = new Set(profiles.map((p) => p.id));
  const teamIds = new Set(teams.map((t) => t.id));
  if (!teams.every((t) => profileIds.has(t.profileId))) return false;
  if (!players.every((p) => teamIds.has(p.teamId))) return false;
  if (!matches.every((m) => teamIds.has(m.teamId))) return false;
  if (!presets.every((p) => teamIds.has(p.teamId))) return false;
  if (!seasons.every((x) => teamIds.has(x.teamId))) return false;
  const teamOfSeason = new Map(seasons.map((x) => [x.id, x.teamId]));
  if (!opponents.every((o) => teamOfSeason.has(o.seasonId))) return false;
  const seasonOfOpponent = new Map(opponents.map((o) => [o.id, o.seasonId]));
  const inOwnSeason = (m: Match) =>
    teamOfSeason.get(m.seasonId) === m.teamId && seasonOfOpponent.get(m.opponentId) === m.seasonId;
  if (!matches.every(inOwnSeason)) return false;
  if (!namesAreUnique(data)) return false;
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
