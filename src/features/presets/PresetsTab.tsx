import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  ListRow,
  ReadOnlyNote,
  useConfirm,
  useFormStyles,
  useListStyles,
} from '@/components';
import {
  filledCount,
  nextPresetName,
  presetFromSet,
  presetToDraft,
  validatePresetName,
} from '@/domain/presets';
import type { LineupPreset } from '@/domain/types';
import { useT } from '@/i18n';
import { canEditTeamNow, useAppStore, usePresetsForTeam, useTeamAccess } from '@/store';

import { PresetNameDialog } from './PresetNameDialog';

export interface PresetsTabProps {
  teamId: string;
  onOpenPreset: (presetId: string) => void;
}

type Dialog = { mode: 'new' } | { mode: 'rename'; preset: LineupPreset } | null;

/**
 * The team's saved lineups: create (asks for a name, then opens it), rename, copy, delete.
 * v10: view-only members only open them (no add / rename / copy / delete).
 */
export function PresetsTab({ teamId, onOpenPreset }: PresetsTabProps) {
  const styles = useListStyles();
  const form = useFormStyles();
  const t = useT();
  const s = t.presets.list;
  const presets = usePresetsForTeam(teamId);
  const { addPreset, updatePreset, deletePreset } = useAppStore.getState();
  const { ask, dialogProps } = useConfirm();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { canEdit, block } = useTeamAccess(teamId);
  // v10 audit L18: a name dialog that was open when this device became view-only is closed,
  // not just hidden — it must not come back by itself when the device may edit again.
  if (!canEdit && dialog) setDialog(null);

  const duplicate = (p: LineupPreset) => {
    const all = useAppStore.getState().presets;
    const copy = validatePresetName(s.copyName(p.name), all, teamId);
    const name = copy.ok ? copy.value : nextPresetName(s.defaultName, all, teamId);
    addPreset({ teamId, name, ...presetFromSet(presetToDraft(p)) });
  };

  return (
    <>
      <ReadOnlyNote block={block} />
      <View style={[styles.headerRow, styles.tabHeader]}>
        <Text style={form.eyebrow}>{s.count(presets.length)}</Text>
        {canEdit ? (
          <Button
            label={s.add}
            accessibilityLabel={s.addLabel}
            onPress={() => setDialog({ mode: 'new' })}
            compact
            testID="new-preset"
          />
        ) : null}
      </View>
      {presets.length === 0 && <EmptyState>{s.empty}</EmptyState>}
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
                canEdit ? (
                  <>
                    <IconButton
                      icon="pencil"
                      accessibilityLabel={s.renameLabel(p.name)}
                      onPress={() => setDialog({ mode: 'rename', preset: p })}
                    />
                    <IconButton
                      icon="copy-outline"
                      accessibilityLabel={s.duplicateLabel(p.name)}
                      onPress={() => duplicate(p)}
                    />
                    <IconButton
                      icon="trash-outline"
                      accessibilityLabel={s.deleteLabel(p.name)}
                      onPress={() =>
                        ask(s.confirmDelete(p.name), () => {
                          // The role may have changed while the question was open (L18).
                          if (canEditTeamNow(teamId)) deletePreset(p.id);
                        })
                      }
                    />
                  </>
                ) : undefined
              }
            />
          );
        })}
      </View>
      <ConfirmDialog {...dialogProps} />
      {canEdit && dialog?.mode === 'new' ? (
        <PresetNameDialog
          teamId={teamId}
          title={t.presets.nameDialog.newTitle}
          confirmLabel={t.presets.nameDialog.create}
          initialName={nextPresetName(s.defaultName, useAppStore.getState().presets, teamId)}
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            setDialog(null);
            if (canEditTeamNow(teamId)) onOpenPreset(addPreset({ teamId, name }).id);
          }}
        />
      ) : null}
      {canEdit && dialog?.mode === 'rename' ? (
        <PresetNameDialog
          teamId={teamId}
          title={t.presets.nameDialog.renameTitle}
          confirmLabel={t.presets.nameDialog.save}
          initialName={dialog.preset.name}
          exceptId={dialog.preset.id}
          onCancel={() => setDialog(null)}
          onSubmit={(name) => {
            if (canEditTeamNow(teamId)) updatePreset(dialog.preset.id, { name });
            setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
