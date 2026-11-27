import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import {
  DISPLAY_FONT_BOLD,
  DISPLAY_FONT_HEAVY,
  DYSLEXIA_FONT_BOLD,
  DYSLEXIA_FONT_REGULAR,
} from '@/theme/fonts';

/**
 * v11: the bundled display typeface (Barlow Condensed, SIL OFL 1.1,
 * `assets/fonts/BarlowCondensed-OFL.txt`) for titles, scores and roster numbers.
 */
export const displayFonts = {
  [DISPLAY_FONT_BOLD]: require('../../assets/fonts/BarlowCondensed-Bold.ttf'),
  [DISPLAY_FONT_HEAVY]: require('../../assets/fonts/BarlowCondensed-ExtraBold.ttf'),
};

/**
 * v8: the bundled OpenDyslexic files (SIL OFL 1.1, `assets/fonts/OFL.txt`), keyed by the family
 * names `makeStyles` puts on text styles (`src/theme/fonts.ts`). Bundled, so they load offline.
 */
export const appFonts = {
  [DYSLEXIA_FONT_REGULAR]: require('../../assets/fonts/OpenDyslexic-Regular.otf'),
  [DYSLEXIA_FONT_BOLD]: require('../../assets/fonts/OpenDyslexic-Bold.otf'),
};

/** How long the start screen waits for the fonts before it goes on with the platform font. */
export const FONT_TIMEOUT_MS = 3000;

/**
 * True once the fonts the app shows are loaded, failed to load or took longer than
 * `FONT_TIMEOUT_MS`: the app never waits forever; without the files the platform font is used.
 * It always waits for the display typeface (v11) and for OpenDyslexic only when `dyslexiaFont`
 * is on (both sets load in the background either way).
 */
export function useAppFonts(dyslexiaFont: boolean): boolean {
  const [displayLoaded, displayError] = useFonts(displayFonts);
  const [dyslexiaLoaded, dyslexiaError] = useFonts(appFonts);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  const displayReady = displayLoaded || displayError !== null;
  const dyslexiaReady = !dyslexiaFont || dyslexiaLoaded || dyslexiaError !== null;
  return (displayReady && dyslexiaReady) || timedOut;
}
