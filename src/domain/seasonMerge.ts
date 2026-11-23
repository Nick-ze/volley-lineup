/**
 * Seasons and opponents in an import merge: same-named ones are matched, names stay unique.
 *
 * Part of the `seasons.ts` barrel: import sibling modules directly, never the barrel.
 */
import { foldName } from './seasonNames';
import type { Match, Opponent, Season } from './types';

type SeasonData = { seasons: Season[]; opponents: Opponent[]; matches: Match[] };

/**
 * v7 QA: before an import is merged, an incoming season with the name of an existing season of
 * the same team (and an incoming opponent with the name of an existing opponent of the same
 * season) becomes that existing one — ignoring case and accents, ids that already match are
 * left to the merge by id. The incoming matches are moved over (and take the existing
 * opponent's name), so a merge never creates two "Rivals" or two "2026/27".
 */
export function alignIncomingByName<T extends SeasonData>(
  existing: Pick<SeasonData, 'seasons' | 'opponents'>,
  incoming: T,
): T {
  const existingSeasonIds = new Set(existing.seasons.map((x) => x.id));
  const seasonMap = new Map<string, string>();
  for (const season of incoming.seasons) {
    if (existingSeasonIds.has(season.id)) continue;
    const same = existing.seasons.find(
      (x) => x.teamId === season.teamId && foldName(x.name) === foldName(season.name),
    );
    if (same) seasonMap.set(season.id, same.id);
  }
  const existingOpponentIds = new Set(existing.opponents.map((o) => o.id));
  const opponentMap = new Map<string, Opponent>();
  const movedOpponents = incoming.opponents.map((o) => ({
    ...o,
    seasonId: seasonMap.get(o.seasonId) ?? o.seasonId,
  }));
  for (const opponent of movedOpponents) {
    if (existingOpponentIds.has(opponent.id)) continue;
    const same = existing.opponents.find(
      (x) => x.seasonId === opponent.seasonId && foldName(x.name) === foldName(opponent.name),
    );
    if (same) opponentMap.set(opponent.id, same);
  }
  return {
    ...incoming,
    seasons: incoming.seasons.filter((x) => !seasonMap.has(x.id)),
    opponents: movedOpponents.filter((o) => !opponentMap.has(o.id)),
    matches: incoming.matches.map((m) => {
      const opponent = opponentMap.get(m.opponentId);
      return {
        ...m,
        seasonId: seasonMap.get(m.seasonId) ?? m.seasonId,
        ...(opponent ? { opponentId: opponent.id, opponent: opponent.name } : {}),
      };
    }),
  };
}

/** True when no team has two seasons and no season two opponents of the same name. */
export function namesAreUnique(data: Pick<SeasonData, 'seasons' | 'opponents'>): boolean {
  const unique = (keys: string[]) => new Set(keys).size === keys.length;
  return (
    unique(data.seasons.map((x) => `${x.teamId}\u0000${foldName(x.name)}`)) &&
    unique(data.opponents.map((o) => `${o.seasonId}\u0000${foldName(o.name)}`))
  );
}
