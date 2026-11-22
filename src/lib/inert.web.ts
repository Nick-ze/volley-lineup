import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/**
 * Makes a view and everything in it unfocusable and hidden from assistive tech (`inert`), e.g.
 * the sliding copies of court spots (v8). On web a View is its DOM element.
 */
export function makeInert(view: ComponentRef<typeof View> | null): void {
  const el = view as unknown as HTMLElement | null;
  el?.setAttribute?.('inert', '');
}
