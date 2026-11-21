import { useCallback, useMemo, useState } from 'react';

import { withSuggestedLiberoReplaces } from '@/domain/liberoSwap';
import { applyLineupEdit, isLineupLocked } from '@/domain/lineupLock';
import {
  benchPlayers,
  lineupForSet,
  movePlayer,
  previousSet,
  tapPlayer,
  tapTarget,
  type DropTarget,
} from '@/domain/lineupEditing';
import { validateLineup } from '@/domain/lineupValidation';
import type { SetLineup, SetNumber } from '@/domain/types';
import { useAppStore, useMatch, usePlayersForTeam } from '@/store';

/**
 * State + actions for editing one set's lineup. The set is written to the store only on the
 * first edit (so just browsing set tabs never creates empty sets).
 */
export function useLineupEditor(matchId: string, setNumber: SetNumber) {
  const match = useMatch(matchId);
  const players = usePlayersForTeam(match?.teamId);
  const saveLineup = useAppStore((s) => s.setLineup);
  // Selection is remembered per set number, so switching tabs drops it.
  const [selection, setSelection] = useState<{ setNumber: SetNumber; id: string | null }>({
    setNumber,
    id: null,
  });
  const selectedId = selection.setNumber === setNumber ? selection.id : null;
  const setSelectedId = useCallback(
    (id: string | null) => setSelection({ setNumber, id }),
    [setNumber],
  );

  const sets = match?.sets;
  const set = useMemo(() => lineupForSet(sets ?? [], setNumber), [sets, setNumber]);
  const previous = useMemo(() => previousSet(sets ?? [], setNumber), [sets, setNumber]);
  const bench = useMemo(() => benchPlayers(set, players), [set, players]);
  const validation = useMemo(() => validateLineup(set, players), [set, players]);

  // Assigning a libero pre-selects the middles they replace (docs/DECISIONS.md).
  // A played set keeps its starting six, libero and first serve (see lineupLock.ts).
  const locked = isLineupLocked(set);
  const update = useCallback(
    (next: SetLineup) => {
      if (next === set) return;
      const kept = applyLineupEdit(set, withSuggestedLiberoReplaces(set, next, players));
      if (kept !== set) saveLineup(matchId, kept);
    },
    [matchId, saveLineup, set, players],
  );

  const drop = useCallback(
    (playerId: string, target: DropTarget) => {
      setSelectedId(null);
      update(movePlayer(set, playerId, target));
    },
    [set, update, setSelectedId],
  );

  const pressPlayer = useCallback(
    (playerId: string) => {
      if (locked) return;
      const r = tapPlayer(set, selectedId, playerId);
      setSelectedId(r.selectedId);
      update(r.set);
    },
    [set, selectedId, update, setSelectedId, locked],
  );

  const pressTarget = useCallback(
    (target: DropTarget) => {
      if (locked) return;
      const r = tapTarget(set, selectedId, target);
      setSelectedId(r.selectedId);
      update(r.set);
    },
    [set, selectedId, update, setSelectedId, locked],
  );

  const playerById = useCallback(
    (id: string | null) => (id ? players.find((p) => p.id === id) : undefined),
    [players],
  );

  return {
    match,
    players,
    set,
    previous,
    bench,
    validation,
    locked,
    selectedId,
    update,
    drop,
    pressPlayer,
    pressTarget,
    playerById,
  };
}

export type LineupEditor = ReturnType<typeof useLineupEditor>;
