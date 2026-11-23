import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/**
 * react-native-web renders a View as a DOM element and its ref is that element; the RN type
 * doesn't say so, hence the one cast.
 */
function asDomNode(view: ComponentRef<typeof View> | null): HTMLElement | null {
  return view as unknown as HTMLElement | null;
}

/**
 * Makes a view and everything in it unfocusable and hidden from assistive tech (`inert`), e.g.
 * the sliding copies of court spots (v8). On web a View is its DOM element.
 */
export function makeInert(view: ComponentRef<typeof View> | null): void {
  asDomNode(view)?.setAttribute?.('inert', '');
}

/** v8.1.1: turns `inert` on or off (a pager page that is hidden now and shown later). */
export function setInert(view: ComponentRef<typeof View> | null, inert: boolean): void {
  const el = asDomNode(view);
  if (inert) el?.setAttribute?.('inert', '');
  else el?.removeAttribute?.('inert');
}
