import { useCallback } from 'react';
import { StyleSheet } from 'react-native';

import type { DropTarget } from '@/domain/lineupEditing';
import { colors, radius } from '@/theme';

import { targetKey, useDrag, type MeasurableView } from './DragContext';

type DragState = ReturnType<typeof useDrag>;

/** Drag feedback for one zone: valid drop zones glow yellow, the hovered one is filled. */
export function zoneFeedback(drag: DragState, key: string) {
  const isValid = drag.active !== null && targetKey(drag.active.from) !== key;
  const isHover = isValid && drag.hoverKey === key;
  const style = isHover ? zoneStyles.hover : isValid ? zoneStyles.valid : undefined;
  return { style, isValid, isHover };
}

/** Registers a view as a drop zone and returns its ref callback and drag-feedback style. */
export function useDropZone(target: DropTarget) {
  const drag = useDrag();
  const key = targetKey(target);
  const { registerZone } = drag;
  const onRef = useCallback(
    (view: MeasurableView | null) => registerZone(target, view),
    // `target` is a fresh object each render; `key` fully identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registerZone, key],
  );
  return { onRef, ...zoneFeedback(drag, key) };
}

export const zoneStyles = StyleSheet.create({
  // Yellow ring + near-black outer ring: yellow alone is ~1.6:1 against the orange court.
  valid: {
    borderWidth: 3,
    borderColor: colors.highlight,
    borderRadius: radius.md,
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.background,
  },
  hover: {
    borderWidth: 3,
    borderColor: colors.highlight,
    borderRadius: radius.md,
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.background,
    backgroundColor: colors.highlightGlow,
  },
});
