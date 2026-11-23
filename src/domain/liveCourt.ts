/**
 * The live court as shown: the real players plus where the libero stands in. Pure, no React.
 *
 * Part of the live-set modules (v8.3 split of `liveSet.ts`, which re-exports the public names):
 * import this module directly inside the domain, never through `liveSet.ts`.
 */
import { applyLiberoSwaps, findLiberoSwap, type LiberoSwap } from './liberoSwap';
import type { Slots } from './rotation';
import type { SetLineup, Side } from './types';

/** The court as shown in live mode: the real players plus where the libero stands in. */
export interface LiveCourtView {
  slots: Slots;
  liberoSwap: LiberoSwap | null;
}

/**
 * Applies the libero swap to the live court. The libero may not serve, so position 1 is only
 * excluded while we serve. Whom the libero replaces comes from the replay: a substitute for a
 * replaced player is replaced too (they take over the role, v4.0 #130); nobody when the libero
 * is switched off. `state` is the replayed `LiveState`.
 */
export function liveCourtView(
  set: SetLineup,
  state: { slots: Slots; servingSide: Side; liberoReplaces: string[] },
): LiveCourtView {
  const options = { serving: state.servingSide === 'us' };
  const replaces = state.liberoReplaces;
  return {
    slots: applyLiberoSwaps(state.slots, set.liberoId, replaces, options),
    liberoSwap: findLiberoSwap(state.slots, set.liberoId, replaces, options),
  };
}
