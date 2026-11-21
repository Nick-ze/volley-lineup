import { useMemo, useState, type ReactNode } from 'react';

import { chooseLastErrorType } from '@/domain/errorTagging';
import { lastRally } from '@/domain/lastRally';
import { tagLastPoint } from '@/domain/pointTags';

import { PointTagRow } from './PointTagRow';
import type { LiveSet } from './useLiveSet';

export interface PointTagging {
  /** The live actions, wrapped: a rally opens the tag row; a sub, undo or reset closes it. */
  live: LiveSet;
  /** The tag row for the rally just recorded, or null. */
  row: ReactNode;
}

/**
 * Optional point tagging (docs/PLAN.md §15.3). The row only refers to the rally just recorded
 * here: the next rally replaces it, a substitution, undo, reset or ✕ closes it, and it never
 * blocks anything. Tags are stored at once on the last point.
 */
export function usePointTagging(live: LiveSet): PointTagging {
  const [open, setOpen] = useState(false);
  const { set, playersById } = live;
  const rally = useMemo(
    () => (open && set ? lastRally(set, [...playersById.values()]) : null),
    [open, set, playersById],
  );

  const wrapped: LiveSet = {
    ...live,
    point: (winner) => {
      live.point(winner);
      setOpen(true);
    },
    substitute: (out, inn) => {
      setOpen(false);
      live.substitute(out, inn);
    },
    undoLast: () => {
      setOpen(false);
      return live.undoLast();
    },
    resetLive: () => {
      setOpen(false);
      live.resetLive();
    },
  };

  const row =
    rally && set ? (
      <PointTagRow
        rally={rally}
        playersById={playersById}
        onTag={(kind, playerId) => live.saveSet(tagLastPoint(set, kind, playerId))}
        onErrorType={(type) => live.saveSet(chooseLastErrorType(set, type, rally))}
        onClose={() => setOpen(false)}
      />
    ) : null;
  return { live: wrapped, row };
}
