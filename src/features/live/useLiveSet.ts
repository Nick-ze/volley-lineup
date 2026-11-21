import { useCallback, useMemo } from 'react';

import {
  addPoint,
  addSub,
  liveCourtView,
  previewSub,
  replaySet,
  undo,
  type LiveCourtView,
  type LiveState,
  type LiveWarningCode,
} from '@/domain/liveSet';
import {
  COURT_POSITIONS,
  type Match,
  type Player,
  type SetLineup,
  type SetNumber,
  type Side,
} from '@/domain/types';
import { resetLiveData } from '@/domain/lineupLock';
import { undoTarget } from '@/domain/matchFlow';
import { getMatchState, type MatchState } from '@/domain/matchState';
import { useAppStore, useMatch, usePlayersForTeam } from '@/store';

export interface LiveSet {
  match: Match | undefined;
  set: SetLineup | undefined;
  /** False when a court position is empty (live mode needs six players). */
  complete: boolean;
  state: LiveState | undefined;
  /** The whole match's result (sets won, winner, current set), derived from all sets. */
  matchState: MatchState | undefined;
  /**
   * The set whose last event Undo removes: this set, or — when this set is untouched — the
   * previous won set (undo across a set end); null when there is nothing to undo.
   */
  undoSet: SetNumber | null;
  /** The court as shown: real players plus the libero swap (undefined without a set). */
  court: LiveCourtView | undefined;
  playersById: Map<string, Player>;
  /** Active players who are neither on court nor the libero, by jersey number. */
  bench: Player[];
  point: (winner: Side) => void;
  substitute: (outPlayerId: string, inPlayerId: string) => void;
  /** Undoes the last event of `undoSet`; returns that set's number (to show it), or null. */
  undoLast: () => SetNumber | null;
  /** Stores a lineup for this match (setup of a new set, serve choice). */
  saveSet: (set: SetLineup) => void;
  /** Clears the set's live data (score, subs) so its lineup can be edited again. */
  resetLive: () => void;
  /** Warnings the substitution would trigger if made now (a warning, never a block). */
  preview: (outPlayerId: string, inPlayerId: string) => LiveWarningCode[];
}

/** The set being played live, its replayed state, and actions that append to its event log. */
export function useLiveSet(matchId: string | undefined, setNumber: SetNumber | undefined): LiveSet {
  const match = useMatch(matchId);
  const players = usePlayersForTeam(match?.teamId);
  const setLineup = useAppStore((s) => s.setLineup);
  const set = match?.sets.find((s) => s.setNumber === setNumber);
  const complete = !!set && COURT_POSITIONS.every((p) => set.slots[p] !== null);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const state = useMemo(() => (set ? replaySet(set, players) : undefined), [set, players]);
  const matchState = useMemo(() => (match ? getMatchState(match) : undefined), [match]);
  const undoSet = match && setNumber !== undefined ? undoTarget(match, setNumber) : null;
  const court = useMemo(() => (set && state ? liveCourtView(set, state) : undefined), [set, state]);
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
    matchState,
    undoSet,
    court,
    playersById,
    bench,
    // The clock lives here, never in the domain: each rally is stamped when it is recorded.
    point: (winner) => save((s) => addPoint(s, winner, new Date().toISOString())),
    substitute: (out, inn) => save((s) => addSub(s, out, inn)),
    undoLast: () => {
      const target = match?.sets.find((s) => s.setNumber === undoSet);
      if (!match || !target) return null;
      setLineup(match.id, undo(target));
      return target.setNumber;
    },
    saveSet: (lineup) => {
      if (match) setLineup(match.id, lineup);
    },
    resetLive: () => save(resetLiveData),
    preview: (out, inn) => (set ? previewSub(set, players, out, inn) : []),
  };
}
