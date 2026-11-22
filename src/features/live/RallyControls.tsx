import type { ReactNode } from 'react';

import type { Player, SetEvent, SetNumber, Side } from '@/domain/types';
import { ServeToggle } from '@/features/lineup/ServeToggle';

import { PointButtons } from './PointButtons';
import { UndoActions } from './UndoActions';

export interface RallyControlsProps {
  opponent: string;
  /** The set's last event (undefined before anything happened). */
  last: SetEvent | undefined;
  /** Before the first rally: who serves first (changeable); null hides the toggle. */
  weServeFirst: boolean | null;
  onServeChange: (weServeFirst: boolean) => void;
  /** With nothing to undo here: the previous won set Undo goes back to. */
  acrossSet: SetNumber | null;
  playersById: Map<string, Player>;
  onPoint: (winner: Side) => void;
  onUndo: () => void;
  onReset: () => void;
  /** Optional content under the point buttons (e.g. point tagging after a rally). */
  belowPointButtons?: ReactNode;
}

/** Serve choice (before the first rally), the rally buttons, a slot under them, undo / reset. */
export function RallyControls({
  opponent,
  last,
  weServeFirst,
  onServeChange,
  acrossSet,
  playersById,
  onPoint,
  onUndo,
  onReset,
  belowPointButtons,
}: RallyControlsProps) {
  return (
    <>
      {weServeFirst !== null ? (
        <ServeToggle weServeFirst={weServeFirst} onChange={onServeChange} />
      ) : null}
      <PointButtons opponent={opponent} onPoint={onPoint} compact={weServeFirst !== null} />
      {belowPointButtons}
      <UndoActions
        last={last}
        acrossSet={acrossSet}
        playersById={playersById}
        onUndo={onUndo}
        onReset={onReset}
      />
    </>
  );
}
