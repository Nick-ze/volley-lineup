import { useCallback } from 'react';

import type { DropTarget } from '@/domain/lineupEditing';
import { makeStyles, radius } from '@/theme';

import { useDrag } from './dragTypes';
import { targetKey, type MeasurableView } from './useZoneMeasurements';

type DragState = ReturnType<typeof useDrag>;
type ZoneStyles = ReturnType<typeof useZoneStyles>;

/** Drag feedback for one zone: valid drop zones glow yellow, the hovered one is filled. */
export function zoneFeedback(drag: DragState, key: string, zoneStyles: ZoneStyles) {
  const isValid = drag.active !== null && targetKey(drag.active.from) !== key;
  const isHover = isValid && drag.hoverKey === key;
  const style = isHover ? zoneStyles.hover : isValid ? zoneStyles.valid : undefined;
  return { style, isValid, isHover };
}

/** Registers a view as a drop zone and returns its ref callback and drag-feedback style. */
export function useDropZone(target: DropTarget) {
  const drag = useDrag();
  const zoneStyles = useZoneStyles();
  const key = targetKey(target);
  const { registerZone } = drag;
  const onRef = useCallback(
    (view: MeasurableView | null) => registerZone(target, view),
    // `target` is a fresh object each render; `key` fully identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registerZone, key],
  );
  return { onRef, ...zoneFeedback(drag, key, zoneStyles) };
}

export const useZoneStyles = makeStyles((theme) => ({
  // Yellow ring + near-black outer ring (`onCourt`): yellow alone is ~1.6:1 against the orange court.
  valid: {
    borderWidth: 3,
    borderColor: theme.colors.highlight,
    borderRadius: radius.md,
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: theme.colors.onCourt,
  },
  hover: {
    borderWidth: 3,
    borderColor: theme.colors.highlight,
    borderRadius: radius.md,
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: theme.colors.onCourt,
    backgroundColor: theme.colors.highlightGlow,
  },
}));
