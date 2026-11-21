/**
 * Where a player is used across a team's matches — needed before deleting a player.
 * A played set (one with live `events`) is replayed on top of its starting six, libero and
 * substitutions, so a player who appears there must not be deleted (it would change the score
 * history or leave the set unplayable). Unplayed sets just lose the player.
 */
import { removePlayer } from './lineupEditing';
import { COURT_POSITIONS, type Match, type SetLineup } from './types';

/** True when the player is a starter, the libero or part of a substitution in this set. */
export function isPlayerInSet(set: SetLineup, playerId: string): boolean {
  return (
    COURT_POSITIONS.some((p) => set.slots[p] === playerId) ||
    set.liberoId === playerId ||
    set.events.some(
      (e) => e.type === 'sub' && (e.outPlayerId === playerId || e.inPlayerId === playerId),
    )
  );
}

/** True when the player appears in any set that already has live data. */
export function isPlayerInPlayedSet(matches: readonly Match[], playerId: string): boolean {
  return matches.some((m) =>
    m.sets.some((set) => set.events.length > 0 && isPlayerInSet(set, playerId)),
  );
}

/**
 * Removes every reference to a player from a set: court, libero, `liberoReplaces` and any
 * substitution events with that player (defensive — the UI blocks deleting players of played
 * sets). Returns the same object when the player isn't referenced.
 */
export function removePlayerEverywhere(set: SetLineup, playerId: string): SetLineup {
  const cleaned = removePlayer(set, playerId);
  const liberoReplaces = cleaned.liberoReplaces.filter((id) => id !== playerId);
  const events = cleaned.events.filter(
    (e) => e.type !== 'sub' || (e.outPlayerId !== playerId && e.inPlayerId !== playerId),
  );
  if (
    cleaned === set &&
    liberoReplaces.length === set.liberoReplaces.length &&
    events.length === set.events.length
  ) {
    return set;
  }
  return { ...cleaned, liberoReplaces, events };
}
