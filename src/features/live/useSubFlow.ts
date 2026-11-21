import { useState } from 'react';

export interface SubFlow {
  /** The substitution panel is open. */
  active: boolean;
  /** The court player picked to go out, if any. */
  outId: string | null;
  start: () => void;
  /** Tapping a court player opens the flow and picks (or un-picks) them. */
  pickOut: (playerId: string) => void;
  /** Cancels a half-finished substitution (also after a rally, undo or reset). */
  reset: () => void;
}

/** UI state of a substitution in progress (who goes out); the sub itself is an event. */
export function useSubFlow(): SubFlow {
  const [active, setActive] = useState(false);
  const [outId, setOutId] = useState<string | null>(null);
  return {
    active,
    outId,
    start: () => setActive(true),
    pickOut: (id) => {
      setActive(true);
      setOutId((cur) => (cur === id ? null : id));
    },
    reset: () => {
      setActive(false);
      setOutId(null);
    },
  };
}
