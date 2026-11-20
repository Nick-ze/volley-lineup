import type { FieldErrorCode } from '@/domain/roster';
import { t } from '@/i18n/en';

/** Maps a domain validation code to its user-facing message. */
export const errorText = (code: FieldErrorCode | undefined): string | undefined =>
  code ? t.roster.errors[code] : undefined;
