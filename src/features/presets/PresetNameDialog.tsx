import { useState } from 'react';
import { View } from 'react-native';

import { Button, Dialog, TextField, useDialogStyles } from '@/components';
import { validatePresetName, type PresetNameError } from '@/domain/presets';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

export interface PresetNameDialogProps {
  teamId: string;
  title: string;
  confirmLabel: string;
  initialName: string;
  /** The preset being renamed (its own name is not "taken"). */
  exceptId?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/** In-app dialog asking for a preset name (new preset / rename). Mount it to show it. */
export function PresetNameDialog({
  teamId,
  title,
  confirmLabel,
  initialName,
  exceptId,
  onSubmit,
  onCancel,
}: PresetNameDialogProps) {
  const styles = useDialogStyles();
  const t = useT();
  const s = t.presets.nameDialog;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<PresetNameError | null>(null);

  const submit = () => {
    const result = validatePresetName(name, useAppStore.getState().presets, teamId, exceptId);
    if (result.ok) onSubmit(result.value);
    else setError(result.error);
  };

  return (
    <Dialog onClose={onCancel} title={title} testID="preset-name-dialog">
      <TextField
        label={s.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        placeholder={s.placeholder}
        error={error ? s.errors[error] : undefined}
        onSubmitEditing={submit}
        autoFocus
        testID="preset-name-input"
      />
      <View style={styles.actions}>
        <Button label={t.common.cancel} variant="secondary" onPress={onCancel} />
        <Button label={confirmLabel} onPress={submit} testID="preset-name-save" />
      </View>
    </Dialog>
  );
}
