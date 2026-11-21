/**
 * Language switching. `useT()` returns the strings for the language chosen in Settings and
 * re-renders the calling component when it changes (it subscribes to the store), so no screen
 * keeps stale text. Every component that shows text calls `const t = useT();`.
 */
import { useAppStore } from '@/store';
import type { Language } from '@/store/types';

import { de } from './de';
import { en, type Strings } from './en';

export type { Strings } from './en';

export const dictionaries: Record<Language, Strings> = { en, de };

/** Strings for a language (pure; for code outside React). */
export const stringsFor = (language: Language): Strings => dictionaries[language];

/** Strings for the current language; re-renders the component when the language changes. */
export function useT(): Strings {
  return stringsFor(useAppStore((s) => s.language));
}
