/**
 * Lineup lock: once a set has live data (`events`), its starting six, libero and first serve are
 * fixed, because the live score, rotation and substitutions are replayed on top of them.
 * Resetting the live data (`resetLiveData`) unlocks the lineup again.
 * `liberoReplaces` and `liberoActive` (v5) stay editable: they only change how the libero is
 * shown, not the replay. The formation (v6) is locked like the starting six.
 */
import { COURT_POSITIONS, type SetLineup } from './types';

/** True when the set has been (partly) played in live mode. */
export function isLineupLocked(set: SetLineup): boolean {
  return set.events.length > 0;
}

/** True when `next` changes the starting six, the formation, the libero or who serves first. */
function changesLockedFields(prev: SetLineup, next: SetLineup): boolean {
  const a = prev.formation;
  const b = next.formation;
  const formationChanged =
    a.system !== b.system || a.order !== b.order || a.setterAt !== b.setterAt;
  return (
    formationChanged ||
    prev.liberoId !== next.liberoId ||
    prev.weServeFirst !== next.weServeFirst ||
    COURT_POSITIONS.some((p) => prev.slots[p] !== next.slots[p])
  );
}

/**
 * The edit to keep: `next`, unless `prev` is locked and `next` changes a locked field (then
 * `prev`, i.e. the edit is refused). Events always come from `prev`, so an edit can't drop them.
 */
export function applyLineupEdit(prev: SetLineup, next: SetLineup): SetLineup {
  if (!isLineupLocked(prev)) return next;
  if (changesLockedFields(prev, next)) return prev;
  return next.events === prev.events ? next : { ...next, events: prev.events };
}

/** The set without live data (score, substitutions); unlocks the lineup. */
export function resetLiveData(set: SetLineup): SetLineup {
  return set.events.length === 0 ? set : { ...set, events: [] };
}
