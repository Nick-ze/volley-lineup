import type { SetLineup, SetNumber } from './types';

/** An empty lineup for a given set: all six slots open, no libero, we serve first. */
export function emptySetLineup(setNumber: SetNumber): SetLineup {
  return {
    setNumber,
    slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    liberoId: null,
    weServeFirst: true,
    liberoReplaces: [],
    events: [],
  };
}
