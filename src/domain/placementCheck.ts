/**
 * Off-position check for moves in the lineup builder (docs/PLAN.md §22.3, DECISIONS #134). Pure
 * functions, no React, no storage.
 *
 * When a drag & drop or a tap-to-select move would make a player play a role that is none of
 * their listed positions (primary or secondary), the builder asks "Are you sure?" first. Only
 * players whose role actually changes are asked about: moving an outside from one OH spot to the
 * other, or a rotation (the formation turns with the players), needs no confirmation.
 */
import { isOffPosition, roleOf, spotRole } from './roles';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Player,
  type Position,
  type SetLineup,
} from './types';

/** A player the move puts on a spot whose role is none of their positions. */
export interface OffPositionPlacement {
  playerId: string;
  position: CourtPosition;
  role: Position;
}

/**
 * The players that `after` puts on an off-position role they did not play in `before` (in
 * court-position order). Empty when the move needs no confirmation. Unknown ids are ignored.
 */
export function newOffPositionPlacements(
  before: Pick<SetLineup, 'slots' | 'formation'>,
  after: Pick<SetLineup, 'slots' | 'formation'>,
  players: readonly Pick<Player, 'id' | 'positions'>[],
): OffPositionPlacement[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  return COURT_POSITIONS.flatMap((position) => {
    const id = after.slots[position];
    const player = id === null ? undefined : byId.get(id);
    if (!player) return [];
    const role = spotRole(after.formation, position);
    if (role === roleOf(before, player.id) || !isOffPosition(player, role)) return [];
    return [{ playerId: player.id, position, role }];
  });
}
