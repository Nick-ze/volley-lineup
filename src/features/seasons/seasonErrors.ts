import type { OpponentNameError, SeasonFormError } from '@/domain/seasons';
import type { Strings } from '@/i18n';

/** The message for a season form / opponent name error code (undefined = no error). */
export function seasonErrorText(
  t: Strings,
  code: SeasonFormError | OpponentNameError | undefined,
  what: 'season' | 'opponent',
): string | undefined {
  const e = t.seasons.errors;
  switch (code) {
    case undefined:
      return undefined;
    case 'REQUIRED':
      return e.required;
    case 'TOO_LONG':
      return e.tooLong;
    case 'DUPLICATE':
      return what === 'season' ? e.duplicateSeason : e.duplicateOpponent;
    case 'INVALID_DATE':
      return e.invalidDate;
    case 'END_BEFORE_START':
      return e.endBeforeStart;
  }
}
