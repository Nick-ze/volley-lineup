/**
 * Live match mode (docs/PLAN.md §4, §11.3, §11.4). Pure functions, no React, no storage.
 *
 * A set's live state is never stored: it is derived by replaying `SetLineup.events` on top of the
 * starting six. Undo = drop the last event.
 *
 * Rally rules: the first server comes from `weServeFirst`. When we win a rally the opponent served,
 * we rotate clockwise (side-out) and serve next. Winning on our own serve keeps the rotation.
 * Losing a rally gives the serve to the opponent; we don't rotate.
 *
 * Substitutions: at most 6 per set (`SUB_LIMIT` beyond). A substitute pairs with the player they
 * replaced: the only allowed later substitution involving either of them is the original player
 * coming back for that substitute, once (`REENTRY_RULE` otherwise). The libero is not a sub.
 * Rule breaches are warnings, never blocks: the event is still applied. Events that can't be
 * applied at all (player not on court, already on court, the libero, unknown) are skipped.
 */
import {
  activeLiberoReplaces,
  applyLiberoSwaps,
  findLiberoSwap,
  type LiberoSwap,
} from './liberoSwap';
import { memoByIdentity2 } from './memo';
import { setterRotation, startingRoles } from './roles';
import {
  ROTATION_COUNT,
  rotateClockwise,
  serverPosition,
  type RotationNumber,
  type Slots,
} from './rotation';
import {
  COURT_POSITIONS,
  type Player,
  type PointEvent,
  type PlayerRoles,
  type SetEvent,
  type SetLineup,
  type Side,
  type SubEvent,
} from './types';

/** Substitutions allowed per set. */
export const MAX_SUBS_PER_SET = 6;

export type LiveWarningCode =
  /** A substitution beyond the 6 allowed per set. */
  | 'SUB_LIMIT'
  /** A substitution that breaks the re-entry rule (wrong partner, or a pair used up). */
  | 'REENTRY_RULE'
  /** A substitution that could not be applied (skipped): see `InvalidSubReason`. */
  | 'INVALID_SUB';

export type InvalidSubReason =
  'OUT_NOT_ON_COURT' | 'IN_ON_COURT' | 'IN_IS_LIBERO' | 'UNKNOWN_PLAYER';

export interface LiveWarning {
  code: LiveWarningCode;
  /** Index of the offending event in `set.events`. */
  eventIndex: number;
  outPlayerId: string;
  inPlayerId: string;
  reason?: InvalidSubReason;
}

export interface Score {
  us: number;
  them: number;
}

export interface LiveState {
  score: Score;
  /** Who is on court now, by position, after all rotations and substitutions. */
  slots: Slots;
  /** 1 = the starting rotation; +1 per side-out, wrapping 6 → 1. */
  rotation: RotationNumber;
  /** v5: roles of the players on court now (substitutes inherit the role of who they replaced). */
  roles: PlayerRoles;
  /** v5: the rotation named after the setter's position (null without a setter on court). */
  setterRotation: RotationNumber | null;
  /** v4.0: whom the libero replaces now — a substitute takes over from the player they replaced. */
  liberoReplaces: string[];
  servingSide: Side;
  /** Our server (position 1) when we serve, otherwise null. */
  serverId: string | null;
  subsUsed: number;
  /** The side that wins the set with the next point, if any. */
  setPoint: Side | null;
  /** The side that has reached the target with a 2-point lead (set ends aren't enforced). */
  setWinner: Side | null;
  warnings: LiveWarning[];
}

/** Points needed to win a set: 25, or 15 in the deciding fifth set. */
export function targetPoints(setNumber: SetLineup['setNumber']): number {
  return setNumber === 5 ? 15 : 25;
}

const other = (side: Side): Side => (side === 'us' ? 'them' : 'us');

/** The side that has won the set (target reached, lead ≥ 2), or null. */
export function setWinnerOf(score: Score, target: number): Side | null {
  for (const side of ['us', 'them'] as const) {
    if (score[side] >= target && score[side] - score[other(side)] >= 2) return side;
  }
  return null;
}

/** The side one point from winning (≥ target − 1 and ahead), or null; null once the set is won. */
export function setPointOf(score: Score, target: number): Side | null {
  if (setWinnerOf(score, target)) return null;
  for (const side of ['us', 'them'] as const) {
    if (score[side] >= target - 1 && score[side] > score[other(side)]) return side;
  }
  return null;
}

function onCourt(slots: Slots, playerId: string): boolean {
  return COURT_POSITIONS.some((p) => slots[p] === playerId);
}

function invalidReason(
  set: SetLineup,
  knownIds: Set<string>,
  slots: Slots,
  outId: string,
  inId: string,
): InvalidSubReason | null {
  if (!knownIds.has(inId) || !knownIds.has(outId)) return 'UNKNOWN_PLAYER';
  if (!onCourt(slots, outId)) return 'OUT_NOT_ON_COURT';
  if (onCourt(slots, inId)) return 'IN_ON_COURT';
  if (set.liberoId === inId) return 'IN_IS_LIBERO';
  return null;
}

/** A rally as it was played: the state just before it (used by the statistics). */
export interface RallyStep {
  type: 'point';
  eventIndex: number;
  event: PointEvent;
  /** Our rotation the rally was played in (before the side-out it may cause). */
  rotation: RotationNumber;
  /** Who served the rally. */
  servingSide: Side;
  /** The real players on court during the rally (without the libero swap). */
  slots: Slots;
  /** v5: roles of the players on court during the rally (substitutes inherit). */
  roles: PlayerRoles;
  /** v5: the rotation named after the setter's position, or null without a setter (roles.ts). */
  setterRotation: RotationNumber | null;
  /** v4.0: whom the libero replaces during the rally (substitutes take over; see #130). */
  liberoReplaces: string[];
}

/** A substitution in the log; `applied` is false when it was skipped (`INVALID_SUB`). */
export interface SubStep {
  type: 'sub';
  eventIndex: number;
  event: SubEvent;
  applied: boolean;
}

export type ReplayStep = RallyStep | SubStep;

const rotationNumber = (rotations: number): RotationNumber =>
  ((rotations % ROTATION_COUNT) + 1) as RotationNumber;

/** Replays a set's event log and returns the live state after the last event. */
export function replaySet(set: SetLineup, players: readonly Player[]): LiveState {
  return replay(set, players).state;
}

/** Replays a set's event log and returns every event with the state it was applied in. */
export function replaySteps(set: SetLineup, players: readonly Player[]): ReplayStep[] {
  return replay(set, players).steps;
}

/** v8.3: cached per set and players array (an unchanged set is never replayed again; read-only). */
const replay = memoByIdentity2(replayUncached);

function replayUncached(
  set: SetLineup,
  players: readonly Player[],
): { state: LiveState; steps: ReplayStep[] } {
  const knownIds = new Set(players.map((p) => p.id));
  const target = targetPoints(set.setNumber);
  const score: Score = { us: 0, them: 0 };
  let slots: Slots = { ...set.slots };
  let rotations = 0;
  let servingSide: Side = set.weServeFirst ? 'us' : 'them';
  let subsUsed = 0;
  const warnings: LiveWarning[] = [];
  /** player id → the player they are paired with by their first substitution. */
  const partner = new Map<string, string>();
  /** "a|b" (sorted) → substitutions made within that pair. */
  const pairUses = new Map<string, number>();
  const steps: ReplayStep[] = [];
  /** v5: player id → role, for everyone who has been on court; subs inherit. */
  const roles: PlayerRoles = startingRoles(set, players);
  /** v4.0: whom the libero replaces; a substitute takes the place of the player they replace. */
  let liberoReplaces: string[] = [...activeLiberoReplaces(set)];
  const onCourtRoles = (): PlayerRoles => {
    const now: PlayerRoles = {};
    for (const p of COURT_POSITIONS) {
      const id = slots[p];
      if (id !== null && roles[id] !== undefined) now[id] = roles[id];
    }
    return now;
  };

  set.events.forEach((event, eventIndex) => {
    if (event.type === 'point') {
      steps.push({
        type: 'point',
        eventIndex,
        event,
        rotation: rotationNumber(rotations),
        servingSide,
        slots,
        roles: onCourtRoles(),
        setterRotation: setterRotation(slots, roles),
        liberoReplaces,
      });
      score[event.winner] += 1;
      if (event.winner === 'us' && servingSide === 'them') {
        slots = rotateClockwise(slots);
        rotations += 1;
      }
      servingSide = event.winner;
      return;
    }

    const { outPlayerId, inPlayerId } = event;
    const base = { eventIndex, outPlayerId, inPlayerId };
    const reason = invalidReason(set, knownIds, slots, outPlayerId, inPlayerId);
    steps.push({ type: 'sub', eventIndex, event, applied: reason === null });
    if (reason) {
      warnings.push({ code: 'INVALID_SUB', ...base, reason });
      return;
    }

    subsUsed += 1;
    if (subsUsed > MAX_SUBS_PER_SET) warnings.push({ code: 'SUB_LIMIT', ...base });

    const key = [outPlayerId, inPlayerId].sort().join('|');
    const outPartner = partner.get(outPlayerId);
    const inPartner = partner.get(inPlayerId);
    if (outPartner === undefined && inPartner === undefined) {
      partner.set(outPlayerId, inPlayerId);
      partner.set(inPlayerId, outPlayerId);
      pairUses.set(key, 1);
    } else if (outPartner === inPlayerId) {
      const uses = (pairUses.get(key) as number) + 1;
      pairUses.set(key, uses);
      if (uses > 2) warnings.push({ code: 'REENTRY_RULE', ...base });
    } else {
      warnings.push({ code: 'REENTRY_RULE', ...base });
    }

    liberoReplaces = liberoReplaces.map((id) => (id === outPlayerId ? inPlayerId : id));
    // v6: every known player on court has a role (each known starter plays the role of their
    // spot, substitutes inherit), so the substitute always takes one over.
    roles[inPlayerId] = roles[outPlayerId];
    const position = COURT_POSITIONS.find((p) => slots[p] === outPlayerId);
    slots = { ...slots, [position as number]: inPlayerId };
  });

  const state: LiveState = {
    score,
    slots,
    rotation: rotationNumber(rotations),
    roles: onCourtRoles(),
    setterRotation: setterRotation(slots, roles),
    liberoReplaces,
    servingSide,
    serverId: servingSide === 'us' ? slots[serverPosition] : null,
    subsUsed,
    setPoint: setPointOf(score, target),
    setWinner: setWinnerOf(score, target),
    warnings,
  };
  return { state, steps };
}

function withEvent(set: SetLineup, event: SetEvent): SetLineup {
  return { ...set, events: [...set.events, event] };
}

/** A new set with a rally won by `winner` appended (v4: `at` = ISO time it was recorded). */
export function addPoint(set: SetLineup, winner: Side, at?: string): SetLineup {
  return withEvent(
    set,
    at === undefined ? { type: 'point', winner } : { type: 'point', winner, at },
  );
}

/** A new set with a substitution appended (`outPlayerId` leaves, `inPlayerId` takes their spot). */
export function addSub(set: SetLineup, outPlayerId: string, inPlayerId: string): SetLineup {
  return withEvent(set, { type: 'sub', outPlayerId, inPlayerId });
}

/** A new set without its last event (unchanged when there is nothing to undo). */
export function undo(set: SetLineup): SetLineup {
  if (set.events.length === 0) return set;
  return { ...set, events: set.events.slice(0, -1) };
}

/**
 * The warnings a substitution would add if made now (e.g. to warn before confirming).
 * Returns the codes only; an empty list means the substitution is fine.
 */
export function previewSub(
  set: SetLineup,
  players: readonly Player[],
  outPlayerId: string,
  inPlayerId: string,
): LiveWarningCode[] {
  const index = set.events.length;
  return replaySet(addSub(set, outPlayerId, inPlayerId), players)
    .warnings.filter((w) => w.eventIndex === index)
    .map((w) => w.code);
}

/** The court as shown in live mode: the real players plus where the libero stands in. */
export interface LiveCourtView {
  slots: Slots;
  liberoSwap: LiberoSwap | null;
}

/**
 * Applies the libero swap to the live court. The libero may not serve, so position 1 is only
 * excluded while we serve. Whom the libero replaces comes from the replay: a substitute for a
 * replaced player is replaced too (they take over the role, v4.0 #130); nobody when the libero
 * is switched off.
 */
export function liveCourtView(set: SetLineup, state: LiveState): LiveCourtView {
  const options = { serving: state.servingSide === 'us' };
  const replaces = state.liberoReplaces;
  return {
    slots: applyLiberoSwaps(state.slots, set.liberoId, replaces, options),
    liberoSwap: findLiberoSwap(state.slots, set.liberoId, replaces, options),
  };
}
