import { useCallback, useMemo } from 'react';

import { addPoint, addSub, replaySet, undo, type LiveState } from '@/domain/liveSet';
import {
  COURT_POSITIONS,
  type Match,
  type Player,
  type SetLineup,
  type Side,
} from '@/domain/types';
import { useAppStore, useMatch, usePlayersForTeam } from '@/store';

export interface LiveSet {
  match: Match | undefined;
  set: SetLineup | undefined;
  /** False when a court position is empty (live mode needs six players). */
  complete: boolean;
  state: LiveState | undefined;
  playersById: Map<string, Player>;
  /** Active players who are neither on court nor the libero, by jersey number. */
  bench: Player[];
  point: (winner: Side) => void;
  substitute: (outPlayerId: string, inPlayerId: string) => void;
  undoLast: () => void;
}

/** The set being played live, its replayed state, and actions that append to its event log. */
export function useLiveSet(matchId: string | undefined, setNumber: number | undefined): LiveSet {
  const match = useMatch(matchId);
  const players = usePlayersForTeam(match?.teamId);
  const setLineup = useAppStore((s) => s.setLineup);
  const set = match?.sets.find((s) => s.setNumber === setNumber);
  const complete = !!set && COURT_POSITIONS.every((p) => set.slots[p] !== null);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const state = useMemo(() => (set ? replaySet(set, players) : undefined), [set, players]);
  const bench = useMemo(() => {
    if (!set || !state) return [];
    const taken = new Set<string | null>([
      ...COURT_POSITIONS.map((p) => state.slots[p]),
      set.liberoId,
    ]);
    return players.filter((p) => p.active && !taken.has(p.id)).sort((a, b) => a.number - b.number);
  }, [players, set, state]);

  const save = useCallback(
    (update: (s: SetLineup) => SetLineup) => {
      if (match && set) setLineup(match.id, update(set));
    },
    [match, set, setLineup],
  );

  return {
    match,
    set,
    complete,
    state,
    playersById,
    bench,
    point: (winner) => save((s) => addPoint(s, winner)),
    substitute: (out, inn) => save((s) => addSub(s, out, inn)),
    undoLast: () => save(undo),
  };
}
