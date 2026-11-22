import { Placeholder } from '@/components';
import { useT } from '@/i18n';

/**
 * `/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats` — one season / tournament: its
 * matches (with search), its opponent teams (record per opponent) and its stats (v7.0, worker A).
 */
export default function SeasonScreen() {
  const t = useT();
  return <Placeholder title={t.seasons.title} />;
}
