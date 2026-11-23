import { useLayoutEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { pageOpacity, pageTranslate } from '@/domain/tabMotion';
import { setInert } from '@/lib/inert';

import type { TabPager as Pager } from './useTabPager';

/** One mounted page: its tab's key (stable, so the page is never remounted) and index. */
export interface PagerPageSpec {
  key: string;
  index: number;
  content: ReactNode;
}

export interface PagerViewProps {
  pager: Pager;
  gesture: PanGesture;
  pages: PagerPageSpec[];
  /** The shown tab: the other pages are inert and hidden from accessibility. */
  index: number;
  style: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  /** The parent's side padding: the pager reaches into it, so pages slide out to its edges. */
  bleed: number;
  testID: string;
}

/** v8.1.1: where page `index` sits for the pager's position (UI thread). */
export function usePageStyle(pager: Pager, index: number) {
  const { position, width, aliasPage, aliasSlot } = pager;
  return useAnimatedStyle(() => {
    const [p, w, page, slot] = [position.value, width.value, aliasPage.value, aliasSlot.value];
    return {
      opacity: pageOpacity(index, p, w, page, slot),
      transform: [{ translateX: pageTranslate(index, p, w, page, slot) }],
    };
  }, [index]);
}

/** Hidden from touch, focus and assistive tech while it is not the shown tab. */
function hiddenPageProps(hidden: boolean) {
  return {
    pointerEvents: hidden ? ('none' as const) : ('auto' as const),
    accessibilityElementsHidden: hidden,
    importantForAccessibility: hidden ? ('no-hide-descendants' as const) : ('auto' as const),
    'aria-hidden': hidden,
  };
}

/**
 * v8.1.1: the pager's views — the clipped box (reaching into the parent's side padding) and one
 * page per mounted tab, keyed by the tab. The page at rest is in normal flow (it gives the box its
 * height); the others lie on top of it, absolutely placed and clipped to that height. All move
 * with the pager's position only, so a tab change never swaps or remounts a page.
 */
export function PagerView({ pager, gesture, pages, index, ...props }: PagerViewProps) {
  const onLayout = (e: LayoutChangeEvent) => {
    pager.width.set(e.nativeEvent.layout.width);
  };
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[
          styles.clip,
          { marginHorizontal: -props.bleed, paddingHorizontal: props.bleed },
          props.style,
        ]}
        onLayout={onLayout}
        testID={`${props.testID}-pager`}
      >
        {pages.map((page) => (
          <PagerPage
            key={page.key}
            pager={pager}
            index={page.index}
            atRest={page.index === pager.rest}
            hidden={page.index !== index}
            restStyle={props.style}
            bleed={props.bleed}
            contentStyle={props.contentStyle}
            testID={`${props.testID}-page-${page.key}`}
          >
            {page.content}
          </PagerPage>
        ))}
      </View>
    </GestureDetector>
  );
}

interface PagerPageProps {
  pager: Pager;
  index: number;
  atRest: boolean;
  hidden: boolean;
  restStyle: StyleProp<ViewStyle>;
  bleed: number;
  contentStyle: StyleProp<ViewStyle>;
  testID: string;
  children: ReactNode;
}

function PagerPage({ pager, index, atRest, hidden, bleed, children, ...props }: PagerPageProps) {
  const content = useRef<ComponentRef<typeof View>>(null);
  const place = usePageStyle(pager, index);
  useLayoutEffect(() => setInert(content.current, hidden), [hidden]);
  return (
    <Animated.View
      style={[atRest ? props.restStyle : [styles.beside, { left: bleed, right: bleed }], place]}
      {...hiddenPageProps(hidden)}
      testID={props.testID}
    >
      <View ref={content} style={[styles.content, props.contentStyle]}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  beside: { position: 'absolute', top: 0, bottom: 0 },
  content: { flexGrow: 1 },
});
