import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

import { DYSLEXIA_FONT_BOLD, DYSLEXIA_FONT_REGULAR } from '@/theme/fonts';

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
 * True once the app's fonts are loaded, failed to load or took longer than `FONT_TIMEOUT_MS`:
 * the app never waits forever; without the files the platform font is used.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(appFonts);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return loaded || error !== null || timedOut;
}
