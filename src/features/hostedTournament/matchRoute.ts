import type { PlanMatch } from '@/domain/hostedTournament';
import type { HostedPlanKind } from '@/domain/types';

/**
 * A match's key within its plan. Round robin: the pair (it meets once). Own matches (v12.1): the
 * stored match's id, because a pair can meet more than once.
 */
export const matchKey = (kind: HostedPlanKind, match: PlanMatch): string =>
  kind === 'manual' && match.result ? match.result.id : `${match.teamA.id}-${match.teamB.id}`;

/** The result screen of a match: by its id (own matches) or by its two teams (round robin). */
export function matchHref(tournamentId: string, kind: HostedPlanKind, match: PlanMatch): string {
  const base = `/tournament/${tournamentId}/match`;
  return kind === 'manual' && match.result
    ? `${base}?m=${match.result.id}`
    : `${base}?a=${match.teamA.id}&b=${match.teamB.id}`;
}

/** v12.2: live scoring of a match (the same match as `matchHref`). */
export const liveHref = (tournamentId: string, kind: HostedPlanKind, match: PlanMatch): string =>
  matchHref(tournamentId, kind, match).replace('/match?', '/live?');
