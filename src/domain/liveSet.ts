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
  ROTATION_COUNT,
  rotateClockwise,
  serverPosition,
  type RotationNumber,
  type Slots,
} from './rotation';
import { COURT_POSITIONS, type Player, type SetEvent, type SetLineup, type Side } from './types';

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

/** Replays a set's event log and returns the live state after the last event. */
export function replaySet(set: SetLineup, players: readonly Player[]): LiveState {
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

  set.events.forEach((event, eventIndex) => {
    if (event.type === 'point') {
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

    const position = COURT_POSITIONS.find((p) => slots[p] === outPlayerId);
    slots = { ...slots, [position as number]: inPlayerId };
  });

  return {
    score,
    slots,
    rotation: ((rotations % ROTATION_COUNT) + 1) as RotationNumber,
    servingSide,
    serverId: servingSide === 'us' ? slots[serverPosition] : null,
    subsUsed,
    setPoint: setPointOf(score, target),
    setWinner: setWinnerOf(score, target),
    warnings,
  };
}

function withEvent(set: SetLineup, event: SetEvent): SetLineup {
  return { ...set, events: [...set.events, event] };
}

/** A new set with a rally won by `winner` appended. */
export function addPoint(set: SetLineup, winner: Side): SetLineup {
  return withEvent(set, { type: 'point', winner });
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
