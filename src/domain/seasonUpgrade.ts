/**
 * Upgrade of data without seasons (store v8 → v9, export file v7 → v8): one season per team.
 *
 * Part of the `seasons.ts` barrel: import sibling modules directly, never the barrel.
 */
import { isRecord as isRec, type Rec } from './legacyData';
import { cleanName, foldName, MAX_SEASON_NAME_LENGTH } from './seasonNames';
import type { Opponent, Season } from './types';

/** The season id an upgraded team's old matches go into (deterministic). */
export const upgradeSeasonId = (teamId: string) => `season-${teamId}`;
/** The opponent id an upgraded opponent name gets (deterministic, per season). */
export const upgradeOpponentId = (seasonId: string, name: string) =>
  `opp-${seasonId}-${encodeURIComponent(foldName(name))}`;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * The name of an upgraded team's season: the team's `season` text ("2026/27"), else the
 * year(s) of its matches ("2026" / "2025–2026"), else the year the team was created.
 */
function upgradeSeasonName(team: Rec, matches: readonly Rec[]): string {
  const given = str(team.season)?.trim();
  if (given) return given.slice(0, MAX_SEASON_NAME_LENGTH);
  const years = matches
    .map((m) => str(m.date)?.slice(0, 4))
    .filter((y): y is string => y !== undefined && /^\d{4}$/.test(y))
    .sort();
  const first = years[0];
  if (first !== undefined) {
    const last = years[years.length - 1] as string; // non-empty: the last exists too
    return first === last ? first : `${first}–${last}`;
  }
  return str(team.createdAt)?.slice(0, 4) ?? '—';
}

/**
 * Upgrades persisted data (store or export file) without seasons: every team gets one season
 * (`upgradeSeasonId`) holding all its matches; every distinct opponent name (compared with
 * `foldName`, first spelling kept, `cleanName`) becomes an opponent of that season; matches get
 * `seasonId` and `opponentId`, and their opponent text becomes that opponent's name. Data that already has seasons, or anything
 * malformed, is passed through for the schema to judge. Deterministic: the same data always
 * upgrades to the same ids (so old files merge cleanly).
 */
export function upgradeToSeasons(data: Rec): Rec {
  if (Array.isArray(data.seasons)) return data;
  const teams = Array.isArray(data.teams) ? data.teams.filter(isRec) : [];
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const seasons: Season[] = [];
  const opponents: Opponent[] = [];
  /** opponent id → the name it keeps (the first spelling, cleaned) */
  const opponentNames = new Map<string, string>();
  for (const team of teams) {
    const teamId = str(team.id);
    if (teamId === undefined) continue;
    const own = matches.filter((m): m is Rec => isRec(m) && m.teamId === teamId);
    const seasonId = upgradeSeasonId(teamId);
    const createdAt = str(team.createdAt) ?? '';
    seasons.push({
      id: seasonId,
      teamId,
      name: upgradeSeasonName(team, own),
      kind: 'season',
      createdAt,
    });
    for (const m of own) {
      const name = str(m.opponent) ?? '';
      const id = upgradeOpponentId(seasonId, name);
      if (opponentNames.has(id)) continue;
      opponentNames.set(id, cleanName(name));
      opponents.push({ id, seasonId, name: cleanName(name), createdAt });
    }
  }
  // A malformed match list is passed through as it is (the schema / store judges it).
  const upgraded = !Array.isArray(data.matches)
    ? data.matches
    : matches.map((m) => {
        if (!isRec(m) || typeof m.teamId !== 'string' || !teams.some((t) => t.id === m.teamId)) {
          return m;
        }
        const seasonId = upgradeSeasonId(m.teamId);
        const opponentId = upgradeOpponentId(seasonId, str(m.opponent) ?? '');
        // v7 QA: the match shows its opponent's name (one spelling per team everywhere).
        return { ...m, seasonId, opponentId, opponent: opponentNames.get(opponentId) };
      });
  return { ...data, seasons, opponents, matches: upgraded };
}
