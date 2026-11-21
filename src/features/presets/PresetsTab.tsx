import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import { filledCount, nextPresetName, validatePresetName } from '@/domain/presets';
import type { LineupPreset } from '@/domain/types';
import { ConfirmDialog } from '@/features/roster/components/ConfirmDialog';
import { ListRow } from '@/features/roster/components/ListRow';
import { listStyles as styles } from '@/features/roster/components/styles';
import { useConfirm } from '@/features/roster/hooks/useConfirm';
import { useT } from '@/i18n';
import { useAppStore, usePresetsForTeam } from '@/store';

import { PresetNameDialog } from './PresetNameDialog';

export interface PresetsTabProps {
  teamId: string;
  onOpenPreset: (presetId: string) => void;
}

type Dialog = { mode: 'new' } | { mode: 'rename'; preset: LineupPreset } | null;

/** The team's saved lineups: create (asks for a name, then opens it), rename, copy, delete. */
export function PresetsTab({ teamId, onOpenPreset }: PresetsTabProps) {
  const t = useT();
  const s = t.presets.list;
  const presets = usePresetsForTeam(teamId);
  const { addPreset, updatePreset, deletePreset } = useAppStore.getState();
  const { ask, dialogProps } = useConfirm();
  const [dialog, setDialog] = useState<Dialog>(null);

  const duplicate = (p: LineupPreset) => {
    const all = useAppStore.getState().presets;
    const copy = validatePresetName(s.copyName(p.name), all, teamId);
    const name = copy.ok ? copy.value : nextPresetName(s.defaultName, all, teamId);
    const { slots, liberoId, liberoReplaces } = p;
    addPreset({ teamId, name, slots: { ...slots }, liberoId, liberoReplaces: [...liberoReplaces] });
  };

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>{s.count(presets.length)}</Text>
        <Button
          label={s.add}
          accessibilityLabel={s.addLabel}
          onPress={() => setDialog({ mode: 'new' })}
          compact
          testID="new-preset"
        />
      </View>
      {presets.length === 0 && <Text style={styles.empty}>{s.empty}</Text>}
      <View style={styles.list}>
        {presets.map((p) => {
          const filled = filledCount(p);
          const libero = p.liberoId !== null;
          return (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={s.summary(filled, libero)}
              onPress={() => onOpenPreset(p.id)}
              accessibilityLabel={`${s.open(p.name)}, ${s.summaryLabel(filled, libero)}`}
              testID={`preset-row-${p.name}`}
              actions={
                <>
                  <Button
                    label={t.common.rename}
                    accessibilityLabel={s.renameLabel(p.name)}
                    variant="secondary"
                    compact
                    onPress={() => setDialog({ mode: 'rename', preset: p })}
                  />
                  <Button
                    label={s.duplicate}
                    accessibilityLabel={s.duplicateLabel(p.name)}
                    variant="secondary"
                    compact
                    onPress={() => duplicate(p)}
                  />
                  <Button
                    label={t.common.delete}
                    accessibilityLabel={s.deleteLabel(p.name)}
                    variant="danger"
                    compact
                    onPress={() => ask(s.confirmDelete(p.name), () => deletePreset(p.id))}
                  />
                </>
              }
            />
          );
        })}
      </View>
      <ConfirmDialog {...dialogProps} />
      {dialog?.mode === 'new' ? (
        <PresetNameDialog
          teamId={teamId}
          title={t.presets.nameDialog.newTitle}
          confirmLabel={t.presets.nameDialog.create}
          initialName={nextPresetName(s.defaultName, useAppStore.getState().presets, teamId)}
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            setDialog(null);
            onOpenPreset(addPreset({ teamId, name }).id);
          }}
        />
      ) : null}
      {dialog?.mode === 'rename' ? (
        <PresetNameDialog
          teamId={teamId}
          title={t.presets.nameDialog.renameTitle}
          confirmLabel={t.presets.nameDialog.save}
          initialName={dialog.preset.name}
          exceptId={dialog.preset.id}
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            updatePreset(dialog.preset.id, { name });
            setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
