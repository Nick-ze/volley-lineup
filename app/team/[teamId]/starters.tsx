import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { NotFound } from '@/components';
import { emptyPresetLineup, type PresetLineup } from '@/domain/presets';
import { PresetLineupEditor } from '@/features/presets/PresetLineupEditor';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useAppStore, useStarters, useTeam } from '@/store';

/** `/team/[teamId]/starters` — edit the team's starters (stored on the first edit). */
export default function TeamStartersScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const team = useTeam(teamId);
  const starters = useStarters(teamId);
  const setStarters = useAppStore((s) => s.setStarters);
  const empty = useMemo(() => emptyPresetLineup(), []);
  useTourPage(team ? 'startersEditor' : null);
  const save = useCallback(
    (lineup: PresetLineup) => setStarters(String(teamId), lineup),
    [teamId, setStarters],
  );

  if (!team)
    return <NotFound message={t.roster.teamNotFound} onBack={() => router.dismissTo('/teams')} />;

  return (
    <PresetLineupEditor
      teamId={team.id}
      lineup={starters ?? empty}
      onSave={save}
      hint={t.presets.editor.startersHint}
    />
  );
}
