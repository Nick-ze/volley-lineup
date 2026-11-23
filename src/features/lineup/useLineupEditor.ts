import { useCallback, useMemo } from 'react';

import { lineupForSet, previousSet } from '@/domain/lineupEditing';
import type { SetLineup, SetNumber } from '@/domain/types';
import { useAppStore, useMatch, usePlayersForTeam } from '@/store';

import { useLineupDraft } from './useLineupDraft';

/**
 * State + actions for editing one set's lineup of a match. The set is written to the store only
 * on the first edit (so just browsing set tabs never creates empty sets).
 */
export function useLineupEditor(matchId: string, setNumber: SetNumber) {
  const match = useMatch(matchId);
  const players = usePlayersForTeam(match?.teamId);
  const saveLineup = useAppStore((s) => s.setLineup);

  const sets = match?.sets;
  const set = useMemo(() => lineupForSet(sets ?? [], setNumber), [sets, setNumber]);
  const previous = useMemo(() => previousSet(sets ?? [], setNumber), [sets, setNumber]);
  const save = useCallback((next: SetLineup) => saveLineup(matchId, next), [matchId, saveLineup]);
  const draft = useLineupDraft({ set, players, save, selectionKey: setNumber });

  return { ...draft, match, previous };
}
