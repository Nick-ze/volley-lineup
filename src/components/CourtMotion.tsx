import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  COURT_SLIDE_DURATION_MS,
  sameSpots,
  spotMoves,
  type SpotKeys,
  type SpotMoves,
} from '@/domain/courtMotion';
import { COURT_POSITIONS, type CourtPosition } from '@/domain/types';

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
  const [state, setState] = useState({ keys, moves: {} as SpotMoves, token: 0 });
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
