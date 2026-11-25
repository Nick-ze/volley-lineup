import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, NotFound, ScreenTitle } from '@/components';
import type { PresetLineup } from '@/domain/presets';
import { PresetLineupEditor } from '@/features/presets/PresetLineupEditor';
import { PresetNameDialog } from '@/features/presets/PresetNameDialog';
import { useTourPage } from '@/features/tour';
import { useT } from '@/i18n';
import { useAppStore, useCanEdit, usePreset } from '@/store';

/** `/team/[teamId]/preset/[presetId]` — edit a named preset's lineup (and rename it). */
export default function PresetScreen() {
  const t = useT();
  const router = useRouter();
  const { teamId, presetId } = useLocalSearchParams<{ teamId: string; presetId: string }>();
  const preset = usePreset(presetId);
  const updatePreset = useAppStore((s) => s.updatePreset);
  const [renaming, setRenaming] = useState(false);
  // v10: view-only members can look at a preset but not rename or change it.
  const canEdit = useCanEdit(teamId);
  useTourPage(
    preset && preset.teamId === teamId && preset.kind === 'preset' ? 'presetEditor' : null,
  );
  const save = useCallback(
    (lineup: PresetLineup) => updatePreset(String(presetId), lineup),
    [presetId, updatePreset],
  );

  if (!preset || preset.teamId !== teamId || preset.kind !== 'preset') {
    return (
      <NotFound
        message={t.presets.editor.notFound}
        onBack={() => router.dismissTo(`/team/${teamId}?tab=presets`)}
      />
    );
  }

  return (
    <>
      <ScreenTitle title={t.presets.editor.title(preset.name)} />
      <PresetLineupEditor
        teamId={preset.teamId}
        lineup={preset}
        onSave={save}
        hint={t.presets.editor.presetHint}
        header={
          canEdit ? (
            <Button
              label={t.presets.editor.rename}
              accessibilityLabel={t.presets.editor.renameLabel}
              variant="secondary"
              compact
              onPress={() => setRenaming(true)}
              testID="rename-preset"
              style={styles.rename}
            />
          ) : undefined
        }
      />
      {renaming && canEdit ? (
        <PresetNameDialog
          teamId={preset.teamId}
          title={t.presets.nameDialog.renameTitle}
          confirmLabel={t.presets.nameDialog.save}
          initialName={preset.name}
          exceptId={preset.id}
          onCancel={() => setRenaming(false)}
          onSubmit={(name) => {
            updatePreset(preset.id, { name });
            setRenaming(false);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  rename: { alignSelf: 'flex-start' },
});
