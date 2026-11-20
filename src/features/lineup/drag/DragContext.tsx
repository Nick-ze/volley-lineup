import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CourtSlotRef } from '@/components';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import {
  hitTest,
  type DropTarget,
  type PlayerLocation,
  type ZoneRect,
} from '@/domain/lineupEditing';
import type { Player } from '@/domain/types';

import { DragOverlay } from './DragOverlay';

/** Any host view (court slots, libero box, bench box). */
export type MeasurableView = CourtSlotRef;

export interface DragItem {
  player: Player;
  from: PlayerLocation;
}

/** Stable string key of a drop target ("slot-3", "libero", "bench"). */
export const targetKey = (t: DropTarget): string =>
  t.kind === 'slot' ? `slot-${t.position}` : t.kind;

interface DragApi {
  registerZone(target: DropTarget, view: MeasurableView | null): void;
  begin(item: DragItem, x: number, y: number): void;
  move(x: number, y: number): void;
  end(x: number, y: number, canceled: boolean): void;
  /** True right after a drag finished, so the trailing click/press is ignored. */
  justDragged(): boolean;
  active: DragItem | null;
  hoverKey: string | null;
  /** Pointer position relative to the provider's root view (drives the overlay chip). */
  x: SharedValue<number>;
  y: SharedValue<number>;
}

const DragContext = createContext<DragApi | null>(null);

export function useDrag(): DragApi {
  const ctx = useContext(DragContext);
  if (!ctx) throw new Error('useDrag must be used inside <DragProvider>');
  return ctx;
}

interface Zone {
  target: DropTarget;
  view: MeasurableView;
}

const measure = (view: MeasurableView): Promise<{ x: number; y: number; w: number; h: number }> =>
  new Promise((resolve) => view.measureInWindow((x, y, w, h) => resolve({ x, y, w, h })));

export interface DragProviderProps {
  onDrop(item: DragItem, target: DropTarget): void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Drag & drop for the lineup builder. Draggable chips report pointer positions (window
 * coordinates) on the JS thread; drop zones register their views and are measured with
 * `measureInWindow` when a drag starts; the drop is hit-tested with the pure `hitTest`.
 */
export function DragProvider({ onDrop, children, style }: DragProviderProps) {
  const rootRef = useRef<MeasurableView>(null);
  const zones = useRef(new Map<string, Zone>());
  const rects = useRef<ZoneRect<string>[]>([]);
  const origin = useRef({ x: 0, y: 0 });
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

  const registerZone = useCallback((target: DropTarget, view: MeasurableView | null) => {
    const key = targetKey(target);
    if (view) zones.current.set(key, { target, view });
    else zones.current.delete(key);
  }, []);

  const begin = useCallback(
    (item: DragItem, px: number, py: number) => {
      activeRef.current = item;
      setActive(item);
      rects.current = [];
      if (rootRef.current) {
        void measure(rootRef.current).then((r) => {
          origin.current = { x: r.x, y: r.y };
          x.set(px - r.x);
          y.set(py - r.y);
        });
      }
      zones.current.forEach((zone, key) => {
        void measure(zone.view).then((r) => {
          rects.current.push({ key, x: r.x, y: r.y, width: r.w, height: r.h });
        });
      });
    },
    [x, y],
  );

  const move = useCallback(
    (px: number, py: number) => {
      if (!activeRef.current) return;
      x.set(px - origin.current.x);
      y.set(py - origin.current.y);
      setHover(hitTest(rects.current, px, py));
    },
    [x, y, setHover],
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
      const key = hitTest(rects.current, px, py);
      const zone = key ? zones.current.get(key) : undefined;
      if (zone) onDrop(item, zone.target);
    },
    [onDrop, setHover],
  );

  const justDragged = useCallback(() => Date.now() - lastDragEnd.current < 400, []);

  const api = useMemo<DragApi>(
    () => ({ registerZone, begin, move, end, justDragged, active, hoverKey, x, y }),
    [registerZone, begin, move, end, justDragged, active, hoverKey, x, y],
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
