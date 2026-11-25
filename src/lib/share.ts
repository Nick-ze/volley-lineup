/**
 * v10: share a text (an invite) with the system share sheet. Native version (React Native's
 * `Share`, which also offers "Copy"); the web version is `share.web.ts`.
 */
import { Share } from 'react-native';

/** What happened: shared, copied to the clipboard (web), closed by the user, or failed. */
export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/** Native: the share sheet is always there (its "Copy" covers copying). */
export function canShareText(): boolean {
  return true;
}

export async function shareText(message: string, title?: string): Promise<ShareOutcome> {
  try {
    const result = await Share.share({ message, title }, { dialogTitle: title, subject: title });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

/** The web app's address for links (`…/join?code=`); native: none, links open the app. */
export function webAppBase(): string | undefined {
  return undefined;
}
