import { useCallback, useState } from 'react';

import { newOffPositionPlacements, type OffPositionPlacement } from '@/domain/placementCheck';
import type { Player, SetLineup } from '@/domain/types';

/** A change waiting for confirmation: a player move, or a new formation (system / order). */
export type PendingKind = 'move' | 'formation';

export interface PendingPlacementOptions {
  set: SetLineup;
  players: Player[];
  /** Applies a change (the lineup draft's `update`). */
  update: (next: SetLineup) => void;
  /** The pending change is dropped when this changes (e.g. the set number). */
  selectionKey: string | number;
  setSelectedId: (id: string | null) => void;
}

/**
 * A move or formation change that puts someone on a role that is none of their positions
 * waits for "Are you sure?" (#134). `propose` applies a change or keeps it pending.
 */
export function usePendingPlacement({
  set,
  players,
  update,
  selectionKey,
  setSelectedId,
}: PendingPlacementOptions) {
  const [pendingMove, setPendingMove] = useState<{
    key: string | number;
    next: SetLineup;
    placements: OffPositionPlacement[];
    kind: PendingKind;
  } | null>(null);
  const pending = pendingMove?.key === selectionKey ? pendingMove : null;

  /**
   * Drag & drop, tap-to-select and formation changes: applies `next`, or asks first when it puts
   * a player on a role that is none of their positions (#134). True when applied right away.
   */
  const propose = useCallback(
    (next: SetLineup, kind: PendingKind = 'move'): boolean => {
      const placements = newOffPositionPlacements(set, next, players);
      if (placements.length === 0) {
        update(next);
        return true;
      }
      setPendingMove({ key: selectionKey, next, placements, kind });
      return false;
    },
    [set, players, update, selectionKey],
  );
  const confirmPending = useCallback(() => {
    if (pending) update(pending.next);
    setPendingMove(null);
    // A confirmed tap-to-select move ends the selection (Cancel keeps it).
    if (pending?.kind === 'move') setSelectedId(null);
  }, [pending, update, setSelectedId]);
  const cancelPending = useCallback(() => setPendingMove(null), []);

  return { pending, propose, confirmPending, cancelPending };
}
