import { Placeholder } from '@/components';
import { useT } from '@/i18n';

/** `/team/[teamId]/season-new?seasonId=` — create (or edit) a season / tournament. Modal (v7.0). */
export default function SeasonFormScreen() {
  const t = useT();
  return <Placeholder title={t.seasons.title} />;
}
