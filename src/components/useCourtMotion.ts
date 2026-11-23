import { useRef, useState, type RefObject } from 'react';
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { sameSpots, spotMoves, type SpotKeys, type SpotMoves } from '@/domain/courtMotion';
import type { CourtPosition } from '@/domain/types';

/** Where each slot is inside the court's grid box (filled in by `onLayout`). */
export interface CourtGeometry {
  rows: { front?: LayoutRectangle; back?: LayoutRectangle };
  slots: Partial<Record<CourtPosition, LayoutRectangle>>;
}

/** The slot's rectangle in the grid box, once the slot and its row have been laid out. */
export function slotRect(geometry: CourtGeometry, position: CourtPosition, isFrontRow: boolean) {
  const row = isFrontRow ? geometry.rows.front : geometry.rows.back;
  const slot = geometry.slots[position];
  if (!row || !slot) return null;
  return { x: row.x + slot.x, y: row.y + slot.y, width: slot.width, height: slot.height };
}

export interface CourtMotion {
  /** Spots whose content slides in (hidden in the slot while its copy slides over the court). */
  moves: SpotMoves;
  /** Changes with every rotation, so a new rotation restarts the slides. */
  token: number;
  geometryRef: RefObject<CourtGeometry>;
  onRowLayout: (isFrontRow: boolean) => (e: LayoutChangeEvent) => void;
  onSlotLayout: (position: CourtPosition) => (e: LayoutChangeEvent) => void;
  /** The slides are over (or could not run): show the slots' own content again. */
  done: () => void;
}

/**
 * v8: watches who stands where (`keys`, player ids) and, when the court rotates, lists the spots
 * whose content slides from its old spot (`spotMoves`). Nothing moves without `keys`, for a drop
 * or swap, or with the OS "reduce motion" setting.
 */
export function useCourtMotion(keys: SpotKeys | undefined): CourtMotion {
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<{
    keys: SpotKeys | undefined;
    moves: SpotMoves;
    token: number;
  }>({ keys, moves: {}, token: 0 });
  if (keys && state.keys && !sameSpots(state.keys, keys)) {
    const moves = reduceMotion ? {} : spotMoves(state.keys, keys);
    setState({ keys, moves, token: state.token + 1 });
  } else if (keys !== state.keys && (!keys || !state.keys)) {
    setState({ keys, moves: {}, token: state.token + 1 });
  }
  const geometryRef = useRef<CourtGeometry>({ rows: {}, slots: {} });
  const token = state.token;
  return {
    moves: state.moves,
    token,
    geometryRef,
    onRowLayout: (isFrontRow) => (e) => {
      geometryRef.current.rows[isFrontRow ? 'front' : 'back'] = e.nativeEvent.layout;
    },
    onSlotLayout: (position) => (e) => {
      geometryRef.current.slots[position] = e.nativeEvent.layout;
    },
    done: () =>
      setState((s) => (s.token === token && Object.keys(s.moves).length ? { ...s, moves: {} } : s)),
  };
}
