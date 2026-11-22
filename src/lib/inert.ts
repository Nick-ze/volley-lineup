import type { ComponentRef } from 'react';
import type { View } from 'react-native';

/**
 * Makes a view and everything in it unfocusable (web: the `inert` attribute). On phones the
 * caller's `accessibilityElementsHidden` / `importantForAccessibility` already do this.
 */
export function makeInert(_view: ComponentRef<typeof View> | null): void {}
