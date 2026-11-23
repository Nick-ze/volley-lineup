import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { hitTest, type DropTarget } from '@/domain/lineupEditing';
import { measureInWindow } from '@/lib/measureInWindow';

import { DragContext, type DragApi, type DragItem } from './dragTypes';
import { DragOverlay } from './DragOverlay';
import { targetKey, useZoneMeasurements, type MeasurableView } from './useZoneMeasurements';

/** A press this soon after a drag ended is the drag's own trailing click: ignore it. */
const CLICK_AFTER_DRAG_MS = 250;

export interface DragProviderProps {
  onDrop(item: DragItem, target: DropTarget): void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** No drags start while true (e.g. the set's lineup is locked by live data). */
  disabled?: boolean;
}

/**
 * Drag & drop for the lineup builder. Draggable chips report pointer positions (window
 * coordinates) on the JS thread; drop zones are measured with `measureInWindow` when a drag
 * starts, and the drop awaits that measurement before hit-testing with the pure `hitTest`.
 * Dropping a chip back where it came from does nothing.
 */
export function DragProvider({ onDrop, children, style, disabled = false }: DragProviderProps) {
  const rootRef = useRef<MeasurableView>(null);
  const zones = useZoneMeasurements();
  const origin = useRef({ x: 0, y: 0 });
  const dragId = useRef(0);
  const lastDragEnd = useRef(0);
  const activeRef = useRef<DragItem | null>(null);
  const hoverRef = useRef<string | null>(null);
  const [active, setActive] = useState<DragItem | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const setHover = useCallback((key: string | null) => {
    if (hoverRef.current === key) return;
    hoverRef.current = key;
    setHoverKey(key);
  }, []);

  const placeOverlay = useCallback(
    (px: number, py: number) => {
      x.set(px - origin.current.x);
      y.set(py - origin.current.y);
    },
    [x, y],
  );

  const begin = useCallback(
    (item: DragItem, px: number, py: number) => {
      if (disabled) return;
      activeRef.current = item;
      setActive(item);
      placeOverlay(px, py); // last known origin: correct unless the page scrolled
      const id = zones.measureAll();
      dragId.current = id;
      const root = rootRef.current;
      if (root) {
        void measureInWindow(root).then((r) => {
          if (dragId.current !== id) return;
          origin.current = { x: r.x, y: r.y };
          if (activeRef.current === item) placeOverlay(px, py);
        });
      }
    },
    [zones, placeOverlay, disabled],
  );

  const move = useCallback(
    (px: number, py: number) => {
      if (!activeRef.current) return;
      placeOverlay(px, py);
      setHover(hitTest(zones.current(), px, py));
    },
    [zones, placeOverlay, setHover],
  );

  const end = useCallback(
    (px: number, py: number, canceled: boolean) => {
      const item = activeRef.current;
      activeRef.current = null;
      setActive(null);
      setHover(null);
      if (!item) return;
      lastDragEnd.current = Date.now();
      if (canceled) return;
      void zones.settled(dragId.current).then((rects) => {
        const key = rects ? hitTest(rects, px, py) : null;
        const target = zones.targetOf(key);
        if (target && key !== targetKey(item.from)) onDrop(item, target);
      });
    },
    [zones, onDrop, setHover],
  );

  const justDragged = useCallback(() => Date.now() - lastDragEnd.current < CLICK_AFTER_DRAG_MS, []);

  const registerZone = zones.register;
  const api = useMemo<DragApi>(
    () => ({ registerZone, begin, move, end, justDragged, disabled, active, hoverKey, x, y }),
    [registerZone, begin, move, end, justDragged, disabled, active, hoverKey, x, y],
  );

  return (
    <DragContext.Provider value={api}>
      <View ref={rootRef} collapsable={false} style={[styles.root, style]}>
        {children}
        {active ? <DragOverlay player={active.player} x={x} y={y} /> : null}
      </View>
    </DragContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { position: 'relative' } });
