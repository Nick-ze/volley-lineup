/**
 * v6: choosing the error type of "our error" in live mode (docs/PLAN.md §25.5). Pure, no React.
 */
import { plausiblePlayerIds, type LastRally } from './lastRally';
import { setLastErrorType, tagLastPoint } from './pointTags';
import type { ErrorType, PointEvent, SetLineup } from './types';

/**
 * The set with the last rally's error type set (`setLastErrorType`; null clears it). The tagged
 * player must fit the type (docs/VOLLEYBALL_RULES.md §7): one who couldn't have made it (e.g. the
 * libero for a block error, a non-server for a serve error) is replaced by our server for a serve
 * error, otherwise dropped. A serve error without a player names our server, as an ace does.
 */
export function chooseLastErrorType(
  set: SetLineup,
  errorType: ErrorType | null,
  rally: Pick<LastRally, 'event' | 'playerIds' | 'serverId' | 'frontRowIds' | 'liberoId'>,
): SetLineup {
  const next = setLastErrorType(set, errorType);
  if (errorType === null || next === set) return next;
  // setLastErrorType only changes a set whose last event is a point.
  const last = next.events[next.events.length - 1] as PointEvent;
  // Who could have made this error, ignoring the current tag (which plausiblePlayerIds keeps).
  const untagged = { ...rally, event: { type: 'point' as const, winner: rally.event.winner } };
  const allowed = plausiblePlayerIds(untagged, 'ourError', errorType);
  const tagged = last.playerId;
  if (tagged !== undefined && allowed.includes(tagged)) return next;
  if (errorType === 'serve' && rally.serverId !== null) {
    return tagLastPoint(next, 'ourError', rally.serverId);
  }
  return tagged === undefined ? next : tagLastPoint(next, 'ourError', null);
}
