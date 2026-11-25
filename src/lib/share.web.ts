/**
 * v10: share a text (an invite) on web: the browser's share sheet (`navigator.share`, phones and
 * some desktops) or, without one, copy it to the clipboard.
 */
import Constants from 'expo-constants';

import type { ShareOutcome } from './share';

export type { ShareOutcome } from './share';

interface ShareNavigator {
  share?: (data: { text?: string; title?: string }) => Promise<void>;
  clipboard?: { writeText?: (text: string) => Promise<void> };
}

const browser = (): ShareNavigator | undefined =>
  (globalThis as { navigator?: ShareNavigator }).navigator;

/** True when the browser has a share sheet; otherwise the button copies ("Copy"). */
export function canShareText(): boolean {
  return typeof browser()?.share === 'function';
}

const isAbort = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

export async function shareText(message: string, title?: string): Promise<ShareOutcome> {
  const nav = browser();
  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text: message, title });
      return 'shared';
    } catch (e) {
      // Closed by the user; any other failure (e.g. not allowed) falls back to copying.
      if (isAbort(e)) return 'dismissed';
    }
  }
  const writeText = nav?.clipboard?.writeText;
  if (typeof writeText !== 'function') return 'failed';
  try {
    await writeText.call(nav?.clipboard, message);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The web app's address (origin + the GitHub Pages base path), for `…/join?code=` links. */
export function webAppBase(): string | undefined {
  const origin = (globalThis as { location?: { origin?: unknown } }).location?.origin;
  if (typeof origin !== 'string' || !origin.startsWith('http')) return undefined;
  const base: unknown = Constants.expoConfig?.experiments?.baseUrl;
  return `${origin}${typeof base === 'string' ? base : ''}`;
}
