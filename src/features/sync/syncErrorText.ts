import type { SyncErrorCode } from '@/domain/types';
import type { Strings } from '@/i18n';

/** A short message for a failed team command (delete for everyone, leave team). */
export function teamCommandErrorText(t: Strings, error: SyncErrorCode): string {
  return t.sync.errors[error];
}
