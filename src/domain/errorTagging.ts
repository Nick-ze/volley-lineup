/**
 * v6: choosing the error type of "our error" in live mode (docs/PLAN.md §25.5). Pure, no React.
 */
import { setLastErrorType, tagLastPoint } from './pointTags';
import type { ErrorType, SetLineup } from './types';

/**
 * The set with the last rally's error type set (`setLastErrorType`; null clears it). A serve
 * error names our server of that rally when no player is tagged yet, as an ace does (only our
 * server can make one, docs/VOLLEYBALL_RULES.md §7).
 */
export function chooseLastErrorType(
  set: SetLineup,
  errorType: ErrorType | null,
  serverId: string | null,
): SetLineup {
  const next = setLastErrorType(set, errorType);
  const last = next.events[next.events.length - 1];
  if (
    errorType === 'serve' &&
    serverId !== null &&
    last?.type === 'point' &&
    last.errorType === 'serve' &&
    last.playerId === undefined
  ) {
    return tagLastPoint(next, 'ourError', serverId);
  }
  return next;
}
