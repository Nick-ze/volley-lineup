import { Placeholder } from '@/components';
import { useT } from '@/i18n';

/** `/match/[matchId]/stats` — statistics of one match (built by the v3 stats task). */
export default function MatchStatsScreen() {
  const t = useT();
  return <Placeholder title={t.nav.matchStats} />;
}
