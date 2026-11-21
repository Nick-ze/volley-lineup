import { Placeholder } from '@/components';
import { useT } from '@/i18n';

/** `/team/[teamId]/players/[playerId]` — player detail: photo, stats, description (v6, worker B). */
export default function PlayerDetailScreen() {
  const t = useT();
  return <Placeholder title={t.playerDetail.title} />;
}
