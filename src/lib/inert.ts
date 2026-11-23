import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/**
 * Makes a view and everything in it unfocusable (web: the `inert` attribute). On phones the
 * caller's `accessibilityElementsHidden` / `importantForAccessibility` already do this.
 */
export function makeInert(_view: ComponentRef<typeof View> | null): void {}

/** v8.1.1: turns `inert` on or off (web only; see `makeInert`). */
export function setInert(_view: ComponentRef<typeof View> | null, _inert: boolean): void {}
