import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutRectangle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { COURT_SLIDE_DURATION_MS } from '@/domain/courtMotion';
import { COURT_POSITIONS, type CourtPosition } from '@/domain/types';
import { makeInert } from '@/lib/inert';

import { slotRect, type CourtMotion } from './useCourtMotion';

export interface CourtGhostsProps {
  motion: CourtMotion;
  isFrontRow: (position: CourtPosition) => boolean;
  /** One slot's box without its fill and border colour, sized and placed by the ghost. */
  boxStyle: (position: CourtPosition) => ViewStyle;
  /** The content box inside the slot (its padding). */
  contentStyle: (position: CourtPosition) => ViewStyle;
  renderContent: (position: CourtPosition) => ReactNode;
}

const EASING = Easing.inOut(Easing.cubic);

/**
 * The sliding copies of the moving spots, drawn above the whole court (so no slot covers them)
 * and never touchable; the real spots below take taps at once. When the slides end the copies go
 * and the spots show their own content again.
 */
export function CourtGhosts({ motion, ...rest }: CourtGhostsProps) {
  const { moves, token, geometryRef, done } = motion;
  const [rects, setRects] = useState<{ token: number; list: GhostRect[] } | null>(null);

  // Before paint: the spots are hidden and their copies placed in the same frame.
  useLayoutEffect(() => {
    const geometry = geometryRef.current;
    const list: GhostRect[] = [];
    for (const to of COURT_POSITIONS) {
      const from = moves[to];
      if (from === undefined) continue;
      const a = slotRect(geometry, from, rest.isFrontRow(from));
      const b = slotRect(geometry, to, rest.isFrontRow(to));
      if (a && b) list.push({ to, rect: b, dx: a.x - b.x, dy: a.y - b.y });
    }
    if (list.length === 0) {
      done();
      return;
    }
    // The copies need the slots' measured layout (an outside system), read once per rotation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRects({ token, list });
    // A frame more than the slide, so the copy sits on the spot when the spot takes over.
    const id = setTimeout(done, COURT_SLIDE_DURATION_MS + 32);
    return () => clearTimeout(id);
    // A new rotation (token) starts new slides; the callbacks change every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, moves]);

  if (!rects || rects.token !== token || Object.keys(moves).length === 0) return null;
  return (
    <View
      ref={makeInert}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      testID="court-ghosts"
    >
      {rects.list.map((g) => (
        <Ghost key={`${token}-${g.to}`} ghost={g} {...rest} />
      ))}
    </View>
  );
}

interface GhostRect {
  to: CourtPosition;
  rect: LayoutRectangle;
  dx: number;
  dy: number;
}

function Ghost({
  ghost,
  boxStyle,
  contentStyle,
  renderContent,
}: { ghost: GhostRect } & Omit<CourtGhostsProps, 'motion' | 'isFrontRow'>) {
  const x = useSharedValue(ghost.dx);
  const y = useSharedValue(ghost.dy);
  useEffect(() => {
    const timing = { duration: COURT_SLIDE_DURATION_MS, easing: EASING };
    // The copy starts on the old spot (initial values) and slides to the new one.
    x.value = withTiming(0, timing);
    y.value = withTiming(0, timing);
  }, [ghost, x, y]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  const { x: left, y: top, width, height } = ghost.rect;
  return (
    <Animated.View
      style={[boxStyle(ghost.to), styles.ghost, { left, top, width, height }, animated]}
    >
      <View style={contentStyle(ghost.to)}>{renderContent(ghost.to)}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', minHeight: 0, margin: 0 },
});
