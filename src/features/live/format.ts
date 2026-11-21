import type { Player } from '@/domain/types';
import { t } from '@/i18n/en';

/** "#8 Smith" for a player id, or "?" when it isn't in the team. */
export function playerRef(playersById: Map<string, Player>, id: string | null): string {
  const p = id ? playersById.get(id) : undefined;
  if (!p) return t.live.unknownPlayer;
  return t.live.playerRef(p.number, p.lastName || p.firstName);
}

/** Full chip description for screen readers ("Number 8, Ann Smith, Outside Hitter"). */
export function playerDescription(p: Player): string {
  const primary = p.positions[0];
  return t.player.chipLabel(
    p.number,
    `${p.firstName} ${p.lastName}`.trim(),
    primary ? t.positions[primary] : '',
  );
}
