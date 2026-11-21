import type { FieldErrorCode } from '@/domain/roster';
import type { Strings } from '@/i18n';

/** Maps a domain validation code to its user-facing message in the current language. */
export const errorText = (t: Strings, code: FieldErrorCode | undefined): string | undefined =>
  code ? t.roster.errors[code] : undefined;
