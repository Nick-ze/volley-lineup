import type { SetLineup, SetNumber } from './types';

/**
 * An empty lineup for a given set: all six slots open, the default 5-1 formation (setter spot at
 * 1), no libero (switched on), we serve first.
 */
export function emptySetLineup(setNumber: SetNumber): SetLineup {
  return {
    setNumber,
    slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    liberoId: null,
    weServeFirst: true,
    liberoReplaces: [],
    events: [],
    formation: { system: '5-1', order: 'outside', setterAt: 1 },
    liberoActive: true,
  };
}
