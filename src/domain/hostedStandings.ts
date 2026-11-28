/**
 * v12 hosted tournaments: the plan with its results, the table and one team's matches. All
 * derived from the teams and the stored results.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import { pairKey, resultsByPair, roundRobin, teamsOfTournament } from './hostedPlan';
import { matchOutcome, setsSeenFrom, type HostedSettings, type MatchOutcome } from './hostedResult';
import { foldName } from './seasonNames';
import type { HostedResult, HostedSetScore, HostedTeam, HostedTournament } from './types';

/** A match of the plan: the pair, its result (if any) and what it means. */
export interface PlanMatch {
  round: number;
  teamA: HostedTeam;
  teamB: HostedTeam;
  result: HostedResult | undefined;
  /** The sets as seen from team A (empty without a result). */
  sets: HostedSetScore[];
  outcome: MatchOutcome;
}

export interface PlanRound {
  round: number;
  matches: PlanMatch[];
  resting: HostedTeam | null;
}

export interface TournamentPlan {
  teams: HostedTeam[];
  rounds: PlanRound[];
  /** Matches in the plan and how many of them are over. */
  total: number;
  played: number;
}

/** The whole plan of a tournament with every match's result and outcome. */
export function tournamentPlan(
  tournament: Pick<HostedTournament, 'id'> & HostedSettings,
  allTeams: readonly HostedTeam[],
  allResults: readonly HostedResult[],
): TournamentPlan {
  const teams = teamsOfTournament(allTeams, tournament.id);
  const byId = new Map(teams.map((t) => [t.id, t]));
  const results = resultsByPair(allResults, tournament.id);
  const team = (id: string) => byId.get(id) as HostedTeam;
  const rounds = roundRobin(teams.map((t) => t.id)).map((r): PlanRound => {
    const matches = r.pairs.map(([a, b]): PlanMatch => {
      const result = results.get(pairKey(a, b));
      const sets = result ? setsSeenFrom(result, a) : [];
      return {
        round: r.round,
        teamA: team(a),
        teamB: team(b),
        result,
        sets,
        outcome: matchOutcome(sets, tournament),
      };
    });
    return { round: r.round, matches, resting: r.resting === null ? null : team(r.resting) };
  });
  const all = rounds.flatMap((r) => r.matches);
  return {
    teams,
    rounds,
    total: all.length,
    played: all.filter((m) => m.outcome.state === 'done').length,
  };
}

/** What the table counts: matches (best of N: 2 per win) or sets (all sets played: 1 per set). */
export type TableCounts = 'matches' | 'sets';

export const tableCounts = (settings: HostedSettings): TableCounts =>
  settings.matchEnd === 'bestOf' ? 'matches' : 'sets';

export const POINTS_PER_WIN = 2;

export interface Standing {
  team: HostedTeam;
  /** Shared by teams equal in points, set difference, ball difference and balls scored. */
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  ballsFor: number;
  ballsAgainst: number;
  /** Table points. */
  points: number;
}

const setDiff = (s: Standing) => s.setsFor - s.setsAgainst;
const ballDiff = (s: Standing) => s.ballsFor - s.ballsAgainst;

/** The ranking order: table points, set difference, ball difference, balls scored. */
function compareStandings(x: Standing, y: Standing): number {
  return (
    y.points - x.points ||
    setDiff(y) - setDiff(x) ||
    ballDiff(y) - ballDiff(x) ||
    y.ballsFor - x.ballsFor
  );
}

/**
 * The table. Only finished matches count. Best-of tournaments count matches (2 for a win),
 * all-sets tournaments count sets (1 per set won). Order: table points, set difference, ball
 * difference, balls scored; teams equal in all four share a rank and are listed by name.
 */
export function standings(
  tournament: Pick<HostedTournament, 'id'> & HostedSettings,
  allTeams: readonly HostedTeam[],
  allResults: readonly HostedResult[],
): Standing[] {
  const plan = tournamentPlan(tournament, allTeams, allResults);
  const counts = tableCounts(tournament);
  const rows = new Map<string, Standing>(
    plan.teams.map((team) => [
      team.id,
      {
        team,
        rank: 0,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        setsFor: 0,
        setsAgainst: 0,
        ballsFor: 0,
        ballsAgainst: 0,
        points: 0,
      },
    ]),
  );
  const add = (id: string, o: MatchOutcome, mine: 'a' | 'b') => {
    const row = rows.get(id) as Standing;
    const [setsFor, setsAgainst] = mine === 'a' ? [o.setsA, o.setsB] : [o.setsB, o.setsA];
    const [ballsFor, ballsAgainst] = mine === 'a' ? [o.ballsA, o.ballsB] : [o.ballsB, o.ballsA];
    row.played += 1;
    if (o.winner === 'draw') row.drawn += 1;
    else if (o.winner === mine) row.won += 1;
    else row.lost += 1;
    row.setsFor += setsFor;
    row.setsAgainst += setsAgainst;
    row.ballsFor += ballsFor;
    row.ballsAgainst += ballsAgainst;
    row.points += counts === 'sets' ? setsFor : o.winner === mine ? POINTS_PER_WIN : 0;
  };
  for (const match of plan.rounds.flatMap((r) => r.matches)) {
    if (match.outcome.state !== 'done') continue;
    add(match.teamA.id, match.outcome, 'a');
    add(match.teamB.id, match.outcome, 'b');
  }
  const sorted = [...rows.values()].sort(
    (x, y) =>
      compareStandings(x, y) ||
      foldName(x.team.name).localeCompare(foldName(y.team.name)) ||
      x.team.order - y.team.order,
  );
  sorted.forEach((row, index) => {
    const before = sorted[index - 1];
    row.rank = index > 0 && compareStandings(before, row) === 0 ? before.rank : index + 1;
  });
  return sorted;
}

/** One team's match as that team sees it. */
export interface TeamMatch {
  round: number;
  opponent: HostedTeam;
  /** The match as planned (team A / B as on the Matches tab). */
  match: PlanMatch;
}

/** A team's matches in plan order (every other team once). */
export function teamMatches(teamId: string, plan: TournamentPlan): TeamMatch[] {
  return plan.rounds.flatMap((r) =>
    r.matches
      .filter((m) => m.teamA.id === teamId || m.teamB.id === teamId)
      .map((m) => ({
        round: m.round,
        opponent: m.teamA.id === teamId ? m.teamB : m.teamA,
        match: m,
      })),
  );
}

/** How many results a team has (they go with the team when it is removed). */
export function resultCountOfTeam(results: readonly HostedResult[], teamId: string): number {
  return results.filter((r) => r.teamAId === teamId || r.teamBId === teamId).length;
}
