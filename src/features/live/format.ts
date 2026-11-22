import { fullName, shortName } from '@/domain/playerNames';
import type { Player, PointEvent } from '@/domain/types';
import type { Strings } from '@/i18n';

/**
 * "#8 Anna" for a player id (v8: the short name, first name first; "Anna M." when a teammate is
 * also called Anna), or "?" when it isn't in the team. `playersById` holds the team's players.
 */
export function playerRef(t: Strings, playersById: Map<string, Player>, id: string | null): string {
  const p = id ? playersById.get(id) : undefined;
  if (!p) return t.live.unknownPlayer;
  return t.live.playerRef(p.number, shortName(p, [...playersById.values()]));
}

/** Full chip description for screen readers ("Number 8, Anna Smith, Outside Hitter"). */
export function playerDescription(t: Strings, p: Player): string {
  const primary = p.positions[0];
  return t.player.chipLabel(p.number, fullName(p), primary ? t.positions[primary] : '');
}

/**
 * "kill #7 Anna" (v6: "our error (serve) #7 Anna") for a tagged rally, or null when the rally
 * has no tag.
 */
export function tagDetail(
  t: Strings,
  playersById: Map<string, Player>,
  event: PointEvent,
): string | null {
  if (event.kind === undefined) return null;
  const player = event.playerId === undefined ? null : playerRef(t, playersById, event.playerId);
  const kind = t.tags.kindNames[event.kind];
  const named =
    event.errorType === undefined
      ? kind
      : t.tags.kindWithErrorType(kind, t.tags.errorTypeDetail[event.errorType]);
  return t.tags.detail(named, player);
}
