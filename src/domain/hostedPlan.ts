/**
 * v12 hosted tournaments: the plan. One group, everyone plays everyone once; the rounds come
 * from the teams in the order they were added (circle method). The plan is derived, never stored.
 *
 * Part of the `hostedTournament.ts` barrel: import sibling modules directly, never the barrel.
 */
import type { HostedResult, HostedTeam } from './types';

export const MIN_HOSTED_TEAMS = 2;
export const MAX_HOSTED_TEAMS = 16;

/** A pair of teams; the first is the one earlier in the team order. */
export type HostedPair = readonly [string, string];

export interface HostedRound {
  /** 1-based. */
  round: number;
  pairs: HostedPair[];
  /** With an odd number of teams: the team that has no match in this round. */
  resting: string | null;
}

/** A tournament's teams in the order they were added (equal orders: by id, so it is stable). */
export function teamsOfTournament(
  teams: readonly HostedTeam[],
  tournamentId: string,
): HostedTeam[] {
  return teams
    .filter((t) => t.tournamentId === tournamentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** The `order` of the next team added to a tournament. */
export function nextTeamOrder(teams: readonly HostedTeam[], tournamentId: string): number {
  return teamsOfTournament(teams, tournamentId).reduce((max, t) => Math.max(max, t.order + 1), 0);
}

/** How many matches a single round robin of `teamCount` teams has. */
export const matchCount = (teamCount: number): number =>
  teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2;

/**
 * The rounds of a single round robin by the circle method: the first team stays, the others
 * move one place per round. With an odd number a free place is added, and the team that meets
 * it rests. Every pair appears exactly once; fewer than two teams give no round.
 */
export function roundRobin(teamIds: readonly string[]): HostedRound[] {
  if (teamIds.length < 2) return [];
  const rank = new Map(teamIds.map((id, index) => [id, index]));
  const circle: (string | null)[] = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, null];
  const size = circle.length;
  const rounds: HostedRound[] = [];
  for (let round = 1; round < size; round += 1) {
    const pairs: HostedPair[] = [];
    let resting: string | null = null;
    for (let i = 0; i < size / 2; i += 1) {
      const one = circle[i];
      const other = circle[size - 1 - i];
      if (one === null) resting = other;
      else if (other === null) resting = one;
      else pairs.push(orderedPair(one, other, rank));
    }
    rounds.push({ round, pairs, resting });
    // The first stays; the last moves to the second place.
    circle.splice(1, 0, circle.pop() as string | null);
  }
  return rounds;
}

function orderedPair(one: string, other: string, rank: ReadonlyMap<string, number>): HostedPair {
  return (rank.get(one) as number) < (rank.get(other) as number) ? [one, other] : [other, one];
}

/** The key of a pair of teams, whichever way round they are given. */
export const pairKey = (one: string, other: string): string =>
  one < other ? `${one}|${other}` : `${other}|${one}`;

/** A tournament's results by pair key. */
export function resultsByPair(
  results: readonly HostedResult[],
  tournamentId: string,
): Map<string, HostedResult> {
  return new Map(
    results
      .filter((r) => r.tournamentId === tournamentId)
      .map((r) => [pairKey(r.teamAId, r.teamBId), r]),
  );
}

/** The result of a pair of teams, if one is stored. */
export function resultOfPair(
  results: readonly HostedResult[],
  tournamentId: string,
  one: string,
  other: string,
): HostedResult | undefined {
  return resultsByPair(results, tournamentId).get(pairKey(one, other));
}
