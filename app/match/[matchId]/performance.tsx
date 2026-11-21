import { Placeholder } from '@/components';
import { useT } from '@/i18n';

/**
 * `/match/[matchId]/performance?set=N|all&player=ID` — per-player performance of a set or the
 * whole match, and one player's detail (v6, worker C).
 */
export default function PerformanceScreen() {
  const t = useT();
  return <Placeholder title={t.performance.title} />;
}
