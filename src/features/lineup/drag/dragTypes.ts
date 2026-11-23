import { createContext, useContext } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { DropTarget, PlayerLocation } from '@/domain/lineupEditing';
import type { Player } from '@/domain/types';

import type { MeasurableView } from './useZoneMeasurements';

export interface DragItem {
  player: Player;
  from: PlayerLocation;
}

export interface DragApi {
  registerZone(target: DropTarget, view: MeasurableView | null): void;
  begin(item: DragItem, x: number, y: number): void;
  move(x: number, y: number): void;
  end(x: number, y: number, canceled: boolean): void;
  /** True right after a drag finished, so the trailing click/press is ignored. */
  justDragged(): boolean;
  /** True while drags are disabled (locked lineup): chips also report themselves disabled. */
  disabled: boolean;
  active: DragItem | null;
  hoverKey: string | null;
  /** Pointer position relative to the provider's root view (drives the overlay chip). */
  x: SharedValue<number>;
  y: SharedValue<number>;
}

export const DragContext = createContext<DragApi | null>(null);

export function useDrag(): DragApi {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside <DragProvider>');
  return ctx;
}
