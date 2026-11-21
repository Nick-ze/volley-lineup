import type { Player, PointEvent } from '@/domain/types';
import type { Strings } from '@/i18n';

/** "#8 Smith" for a player id, or "?" when it isn't in the team. */
export function playerRef(t: Strings, playersById: Map<string, Player>, id: string | null): string {
  const p = id ? playersById.get(id) : undefined;
  if (!p) return t.live.unknownPlayer;
  return t.live.playerRef(p.number, p.lastName || p.firstName);
}

/** Full chip description for screen readers ("Number 8, Ann Smith, Outside Hitter"). */
export function playerDescription(t: Strings, p: Player): string {
  const primary = p.positions[0];
  return t.player.chipLabel(
    p.number,
    `${p.firstName} ${p.lastName}`.trim(),
    primary ? t.positions[primary] : '',
  );
}

/** "kill #7 Smith" for a tagged rally, or null when the rally has no tag. */
export function tagDetail(
  t: Strings,
  playersById: Map<string, Player>,
  event: PointEvent,
): string | null {
  if (event.kind === undefined) return null;
  const player = event.playerId === undefined ? null : playerRef(t, playersById, event.playerId);
  return t.tags.detail(t.tags.kindNames[event.kind], player);
}
