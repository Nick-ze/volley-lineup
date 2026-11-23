import { useCallback, useMemo, useState } from 'react';

import { withSuggestedLiberoReplaces } from '@/domain/liberoSwap';
import { applyLineupEdit, isLineupLocked } from '@/domain/lineupLock';
import {
  benchPlayers,
  movePlayer,
  tapPlayer,
  tapTarget,
  type DropTarget,
} from '@/domain/lineupEditing';
import { validateLineup } from '@/domain/lineupValidation';
import type { Player, SetLineup } from '@/domain/types';

import { usePendingPlacement } from './usePendingPlacement';

export interface LineupDraftOptions {
  /** The lineup being edited (a match set, or a preset's draft set). */
  set: SetLineup;
  /** The team's players. */
  players: Player[];
  /** Stores an edited lineup; only called when something actually changed. */
  save: (next: SetLineup) => void;
  /** The selection is dropped when this changes (e.g. the set number). */
  selectionKey?: string | number;
}

/**
 * State + actions for editing any lineup in the lineup builder (drag & drop, tap-to-select,
 * libero, templates). Used by the match screen (`useLineupEditor`) and the preset editor.
 */
export function useLineupDraft({ set, players, save, selectionKey = 0 }: LineupDraftOptions) {
  // Selection is remembered per key, so switching sets drops it.
  const [selection, setSelection] = useState<{ key: string | number; id: string | null }>({
    key: selectionKey,
    id: null,
  });
  const selectedId = selection.key === selectionKey ? selection.id : null;
  const setSelectedId = useCallback(
    (id: string | null) => setSelection({ key: selectionKey, id }),
    [selectionKey],
  );

  const bench = useMemo(() => benchPlayers(set, players), [set, players]);
  const validation = useMemo(() => validateLineup(set, players), [set, players]);

  // Assigning a libero pre-selects the middles they replace (docs/DECISIONS.md).
  // A played set keeps its starting six, libero and first serve (see lineupLock.ts).
  const locked = isLineupLocked(set);
  const update = useCallback(
    (next: SetLineup) => {
      if (next === set) return;
      const kept = applyLineupEdit(set, withSuggestedLiberoReplaces(set, next, players));
      if (kept !== set) save(kept);
    },
    [save, set, players],
  );

  /** Replaces the whole lineup as given (no libero suggestion), e.g. when applying a preset. */
  const replace = useCallback(
    (next: SetLineup) => {
      if (next === set) return;
      const kept = applyLineupEdit(set, next);
      if (kept !== set) save(kept);
    },
    [save, set],
  );

  // A move or formation change that puts someone on a role that is none of their positions
  // waits for "Are you sure?".
  const { pending, propose, confirmPending, cancelPending } = usePendingPlacement({
    set,
    players,
    update,
    selectionKey,
    setSelectedId,
  });

  const drop = useCallback(
    (playerId: string, target: DropTarget) => {
      setSelectedId(null);
      propose(movePlayer(set, playerId, target));
    },
    [set, propose, setSelectedId],
  );

  const pressPlayer = useCallback(
    (playerId: string) => {
      if (locked) return;
      const r = tapPlayer(set, selectedId, playerId);
      // While the move waits for "Are you sure?", the player stays selected (Cancel keeps it).
      if (propose(r.set)) setSelectedId(r.selectedId);
    },
    [set, selectedId, propose, setSelectedId, locked],
  );

  const pressTarget = useCallback(
    (target: DropTarget) => {
      if (locked) return;
      const r = tapTarget(set, selectedId, target);
      // While the move waits for "Are you sure?", the player stays selected (Cancel keeps it).
      if (propose(r.set)) setSelectedId(r.selectedId);
    },
    [set, selectedId, propose, setSelectedId, locked],
  );

  const playerById = useCallback(
    (id: string | null) => (id ? players.find((p) => p.id === id) : undefined),
    [players],
  );

  return {
    players,
    set,
    bench,
    validation,
    locked,
    selectedId,
    update,
    replace,
    drop,
    pressPlayer,
    pressTarget,
    playerById,
    /** The move waiting for confirmation (off position), or null. */
    pending: pending?.placements ?? null,
    /** What the pending change is: a player move or a formation change. */
    pendingKind: pending?.kind ?? null,
    propose,
    confirmPending,
    cancelPending,
  };
}

export type LineupDraft = ReturnType<typeof useLineupDraft>;
