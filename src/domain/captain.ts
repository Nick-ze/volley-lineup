/**
 * v9.1 team captain: one player of a team may be its captain (`Team.captainId`), none by default.
 * Pure helpers for the player form, the store (deleting the captain) and the import checks.
 */
import type { Player, Team } from './types';

/** True when `playerId` is the team's captain (false without a team). */
export function isCaptain(team: Pick<Team, 'captainId'> | undefined, playerId: string): boolean {
  return team?.captainId !== undefined && team.captainId === playerId;
}

/** The team with `playerId` as its captain (replacing any other), or with no captain for null. */
export function setCaptain<T extends Pick<Team, 'captainId'>>(team: T, playerId: string | null): T {
  if (playerId !== null)
    return team.captainId === playerId ? team : { ...team, captainId: playerId };
  if (team.captainId === undefined) return team;
  const { captainId: _cleared, ...rest } = team;
  return rest as T;
}

/**
 * The player form's "Team captain" switch on save: on makes the player the captain (the previous
 * captain loses it); off clears it only when this player was the captain.
 */
export function chooseCaptain<T extends Pick<Team, 'captainId'>>(
  team: T,
  playerId: string,
  on: boolean,
): T {
  if (on) return setCaptain(team, playerId);
  return isCaptain(team, playerId) ? setCaptain(team, null) : team;
}

/** The team without a captain when that captain isn't one of `players` of this team. */
export function withValidCaptain<T extends Pick<Team, 'id' | 'captainId'>>(
  team: T,
  players: readonly Pick<Player, 'id' | 'teamId'>[],
): T {
  if (team.captainId === undefined) return team;
  const ok = players.some((p) => p.id === team.captainId && p.teamId === team.id);
  return ok ? team : setCaptain(team, null);
}
