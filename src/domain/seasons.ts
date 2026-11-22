/**
 * v8 (app 7.0): seasons / tournaments and their opponent teams (docs/PLAN.md §28–30). Pure
 * functions, no React, no storage, no user-facing text (errors are codes).
 *
 * Every match belongs to a season (or tournament) of its team and plays against one of that
 * season's opponents. `Match.opponent` keeps the opponent's name (it is renamed with them).
 */
import { getMatchState } from './matchState';
import { isValidIsoDate } from './roster';
import type { Match, Opponent, Season, SeasonKind } from './types';

export const SEASON_KINDS: readonly SeasonKind[] = ['season', 'tournament'] as const;
export const MAX_SEASON_NAME_LENGTH = 40;
export const MAX_OPPONENT_NAME_LENGTH = 60;
export const MAX_LOCATION_LENGTH = 80;

/** Lower case, no accents, single spaces: how names are compared ("München " ≈ "munchen"). */
export function foldName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/* ------------------------------------------------------------------ migration */

/** The season id an upgraded team's old matches go into (deterministic). */
export const upgradeSeasonId = (teamId: string) => `season-${teamId}`;
/** The opponent id an upgraded opponent name gets (deterministic, per season). */
export const upgradeOpponentId = (seasonId: string, name: string) =>
  `opp-${seasonId}-${encodeURIComponent(foldName(name))}`;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
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
 * `foldName`, first spelling kept) becomes an opponent of that season; matches get `seasonId`
 * and `opponentId` and keep their opponent text. Data that already has seasons, or anything
 * malformed, is passed through for the schema to judge. Deterministic: the same data always
 * upgrades to the same ids (so old files merge cleanly).
 */
export function upgradeToSeasons(data: Rec): Rec {
  if (Array.isArray(data.seasons)) return data;
  const teams = Array.isArray(data.teams) ? data.teams.filter(isRec) : [];
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const seasons: Season[] = [];
  const opponents: Opponent[] = [];
  const opponentIds = new Set<string>();
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
      if (opponentIds.has(id)) continue;
      opponentIds.add(id);
      opponents.push({ id, seasonId, name: name.trim(), createdAt });
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
        return { ...m, seasonId, opponentId: upgradeOpponentId(seasonId, str(m.opponent) ?? '') };
      });
  return { ...data, seasons, opponents, matches: upgraded };
}

/* ------------------------------------------------------------------ forms */

export interface SeasonFormInput {
  name: string;
  kind: SeasonKind;
  startDate: string;
  endDate: string;
  location: string;
}

export type SeasonFormField = 'name' | 'startDate' | 'endDate' | 'location';
export type SeasonFormError =
  'REQUIRED' | 'TOO_LONG' | 'DUPLICATE' | 'INVALID_DATE' | 'END_BEFORE_START';

export type SeasonFormResult =
  | { ok: true; value: Pick<Season, 'name' | 'kind' | 'startDate' | 'endDate' | 'location'> }
  | { ok: false; errors: Partial<Record<SeasonFormField, SeasonFormError>> };

/**
 * Validates the season form: a name (≤ 40, unique within the team ignoring case and accents,
 * except the season being edited), optional ISO dates with the end not before the start, an
 * optional place (≤ 80). Blank optional fields are left out.
 */
export function validateSeasonForm(
  input: SeasonFormInput,
  seasons: readonly Season[],
  teamId: string,
  editingId: string | null = null,
): SeasonFormResult {
  const errors: Partial<Record<SeasonFormField, SeasonFormError>> = {};
  const name = input.name.trim();
  if (name === '') errors.name = 'REQUIRED';
  else if (name.length > MAX_SEASON_NAME_LENGTH) errors.name = 'TOO_LONG';
  else if (
    seasons.some(
      (s) => s.teamId === teamId && s.id !== editingId && foldName(s.name) === foldName(name),
    )
  ) {
    errors.name = 'DUPLICATE';
  }
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();
  if (startDate !== '' && !isValidIsoDate(startDate)) errors.startDate = 'INVALID_DATE';
  if (endDate !== '' && !isValidIsoDate(endDate)) errors.endDate = 'INVALID_DATE';
  else if (endDate !== '' && startDate !== '' && !errors.startDate && endDate < startDate) {
    errors.endDate = 'END_BEFORE_START';
  }
  const location = input.location.trim();
  if (location.length > MAX_LOCATION_LENGTH) errors.location = 'TOO_LONG';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      kind: input.kind,
      ...(startDate === '' ? {} : { startDate }),
      ...(endDate === '' ? {} : { endDate }),
      ...(location === '' ? {} : { location }),
    },
  };
}

export type OpponentNameError = 'REQUIRED' | 'TOO_LONG' | 'DUPLICATE';

/** Validates an opponent name within a season (unique ignoring case / accents). */
export function validateOpponentName(
  name: string,
  opponents: readonly Opponent[],
  seasonId: string,
  editingId: string | null = null,
): { ok: true; name: string } | { ok: false; error: OpponentNameError } {
  const trimmed = name.trim();
  if (trimmed === '') return { ok: false, error: 'REQUIRED' };
  if (trimmed.length > MAX_OPPONENT_NAME_LENGTH) return { ok: false, error: 'TOO_LONG' };
  const taken = opponents.some(
    (o) => o.seasonId === seasonId && o.id !== editingId && foldName(o.name) === foldName(trimmed),
  );
  return taken ? { ok: false, error: 'DUPLICATE' } : { ok: true, name: trimmed };
}

/** The season's opponent with this name (ignoring case / accents), if any. */
export function findOpponentByName(
  opponents: readonly Opponent[],
  seasonId: string,
  name: string,
): Opponent | undefined {
  const folded = foldName(name);
  return opponents.find((o) => o.seasonId === seasonId && foldName(o.name) === folded);
}

/* ------------------------------------------------------------------ lists */

/** A team's seasons, newest first (start date, else creation time), then by name. */
export function seasonsForTeam(seasons: readonly Season[], teamId: string): Season[] {
  const key = (s: Season) => s.startDate ?? s.createdAt.slice(0, 10);
  return seasons
    .filter((s) => s.teamId === teamId)
    .sort((a, b) => key(b).localeCompare(key(a)) || a.name.localeCompare(b.name));
}

/** A season's opponents, by name. */
export function opponentsForSeason(opponents: readonly Opponent[], seasonId: string): Opponent[] {
  return opponents
    .filter((o) => o.seasonId === seasonId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True when an opponent has matches (it can't be deleted then). */
export function opponentHasMatches(matches: readonly Match[], opponentId: string): boolean {
  return matches.some((m) => m.opponentId === opponentId);
}

/* ------------------------------------------------------------------ records */

export interface OpponentRecord {
  opponent: Opponent;
  /** Matches with at least one rally. */
  played: number;
  won: number;
  lost: number;
  inProgress: number;
  /** Matches not started yet. */
  upcoming: number;
  setsWon: number;
  setsLost: number;
}

/**
 * The season's record against each of its opponents (every opponent listed, also without
 * matches), in name order. Results are derived as everywhere (`getMatchState`).
 */
export function opponentRecords(
  opponents: readonly Opponent[],
  matches: readonly Match[],
  seasonId: string,
): OpponentRecord[] {
  return opponentsForSeason(opponents, seasonId).map((opponent) => {
    const record: OpponentRecord = {
      opponent,
      played: 0,
      won: 0,
      lost: 0,
      inProgress: 0,
      upcoming: 0,
      setsWon: 0,
      setsLost: 0,
    };
    for (const match of matches) {
      if (match.opponentId !== opponent.id) continue;
      const state = getMatchState(match);
      if (state.status === 'notStarted') {
        record.upcoming += 1;
        continue;
      }
      record.played += 1;
      if (state.status === 'won') record.won += 1;
      else if (state.status === 'lost') record.lost += 1;
      else record.inProgress += 1;
      record.setsWon += state.setsWon.us;
      record.setsLost += state.setsWon.them;
    }
    return record;
  });
}
