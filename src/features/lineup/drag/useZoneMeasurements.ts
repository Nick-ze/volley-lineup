import { useCallback, useMemo, useRef } from 'react';

import type { CourtSlotRef } from '@/components';
import type { DropTarget, ZoneRect } from '@/domain/lineupEditing';
import { measureInWindow } from '@/lib/measureInWindow';

/** Any host view (court slots, libero box, bench box, provider root). */
export type MeasurableView = CourtSlotRef;

/** Stable string key of a drop target ("slot-3", "libero", "bench"). */
export const targetKey = (t: DropTarget): string =>
  t.kind === 'slot' ? `slot-${t.position}` : t.kind;

interface Measurement {
  id: number;
  done: Promise<ZoneRect<string>[]>;
}

/**
 * Registry of drop-zone views plus their window rectangles, measured once per drag.
 * Each drag gets an id; results that belong to an older drag are discarded, and the drop
 * awaits the measurement of its own drag before hit-testing.
 */
export function useZoneMeasurements() {
  const zones = useRef(new Map<string, { target: DropTarget; view: MeasurableView }>());
  const rects = useRef<ZoneRect<string>[]>([]);
  const lastId = useRef(0);
  const measurement = useRef<Measurement | null>(null);

  const register = useCallback((target: DropTarget, view: MeasurableView | null) => {
    const key = targetKey(target);
    if (view) zones.current.set(key, { target, view });
    else zones.current.delete(key);
  }, []);

  /** Starts measuring every zone for a new drag; returns the drag id. */
  const measureAll = useCallback((): number => {
    lastId.current += 1;
    const id = lastId.current;
    rects.current = [];
    const entries = [...zones.current.entries()];
    const done = Promise.all(
      entries.map(([key, z]) => measureInWindow(z.view).then((r) => ({ key, ...r }))),
    ).then((all) => {
      if (lastId.current === id) rects.current = all;
      return all;
    });
    measurement.current = { id, done };
    return id;
  }, []);

  /** Rectangles measured so far for the current drag (for hover feedback while moving). */
  const current = useCallback(() => rects.current, []);

  /** The rectangles of drag `id` once measured, or null if that drag's measurement is stale. */
  const settled = useCallback(async (id: number): Promise<ZoneRect<string>[] | null> => {
    const m = measurement.current;
    if (!m || m.id !== id) return null;
    const all = await m.done;
    return lastId.current === id ? all : null;
  }, []);

  const targetOf = useCallback((key: string | null) => {
    return key ? (zones.current.get(key)?.target ?? null) : null;
  }, []);

  return useMemo(
    () => ({ register, measureAll, current, settled, targetOf }),
    [register, measureAll, current, settled, targetOf],
  );
}
