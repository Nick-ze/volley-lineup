import { useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components';
import { validatePresetName, type PresetNameError } from '@/domain/presets';
import { TextField } from '@/features/roster/components/TextField';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { dialogMaxWidth, makeStyles, radius, spacing, typography } from '@/theme';

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
  const styles = useStyles();
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
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal testID="preset-name-dialog">
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
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
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: dialogMaxWidth,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.subheading, color: theme.colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
}));
