/**
 * Substitution rules of a set: which substitutions can be applied at all, the limit per set and
 * the re-entry rule (a substitute pairs with the player they replaced; the only later
 * substitution involving either of them is the original player coming back for that substitute,
 * once). Pure, no React.
 *
 * Part of the live-set modules (v8.3 split of `liveSet.ts`, which re-exports the public names):
 * import this module directly inside the domain, never through `liveSet.ts`.
 */
import type { Slots } from './rotation';
import { COURT_POSITIONS, type SetLineup } from './types';

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

export function onCourt(slots: Slots, playerId: string): boolean {
  return COURT_POSITIONS.some((p) => slots[p] === playerId);
}

/** Why a substitution can't be applied (it is skipped), or null when it can. */
export function invalidReason(
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

/** A pair made by a first substitution; both players share it. */
interface Pairing {
  partner: string;
  pair: { uses: number };
}

/**
 * The re-entry bookkeeping of one set's replay. `breaksReentry` records an applied substitution
 * and says whether it breaks the re-entry rule: a first substitution of two unpaired players pairs
 * them; the original player coming back for their substitute is the pair's second (and last
 * allowed) use; anything else involving a paired player breaks the rule.
 */
export function createSubTracker(): { breaksReentry: (outId: string, inId: string) => boolean } {
  const pairings = new Map<string, Pairing>();
  return {
    breaksReentry(outId, inId) {
      const out = pairings.get(outId);
      if (out === undefined && !pairings.has(inId)) {
        const pair = { uses: 1 };
        pairings.set(outId, { partner: inId, pair });
        pairings.set(inId, { partner: outId, pair });
        return false;
      }
      if (out?.partner === inId) {
        out.pair.uses += 1;
        return out.pair.uses > 2;
      }
      return true;
    },
  };
}

/** The court with `inId` in the spot of `outId` (who is on court: the substitution is valid). */
export function substitute(slots: Slots, outId: string, inId: string): Slots {
  const next = { ...slots };
  for (const p of COURT_POSITIONS) {
    if (next[p] === outId) {
      next[p] = inId;
      break;
    }
  }
  return next;
}
