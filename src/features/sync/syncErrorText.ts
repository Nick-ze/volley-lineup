import type { SyncErrorCode } from '@/domain/types';
import type { Strings } from '@/i18n';

/** A short message for a failed team command (delete for everyone, leave team). */
export function teamCommandErrorText(t: Strings, error: SyncErrorCode): string {
  const s = t.sync.teamDelete.errors;
  switch (error) {
    case 'offline':
      return s.offline;
    case 'lastManager':
      return s.lastManager;
    case 'lastMember':
      return s.lastMember;
    case 'forbidden':
      return s.forbidden;
    case 'notSignedIn':
    case 'signedOut':
      return s.signIn;
    default:
      return s.unknown;
  }
}
