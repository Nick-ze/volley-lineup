import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components';
import { MAX_DESCRIPTION_LENGTH, normalizeDescription } from '@/domain/photos';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

/** Lines of text the field shows before it scrolls. */
const FIELD_LINES = 5;

/**
 * Edit one player's confidential description. Only rendered while descriptions are unlocked.
 * Saving a blank text removes the description.
 */
export function DescriptionEditor({ player }: { player: Player }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  const s = t.playerDetail.description;
  const [draft, setDraft] = useState(player.description ?? '');
  const [saved, setSaved] = useState<'saved' | 'removed' | null>(null);

  const save = () => {
    const description = normalizeDescription(draft);
    useAppStore.getState().updatePlayer(player.id, { description });
    setDraft(description ?? '');
    setSaved(description === undefined ? 'removed' : 'saved');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{s.field}</Text>
      <TextInput
        accessibilityLabel={s.field}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setSaved(null);
        }}
        multiline
        numberOfLines={FIELD_LINES}
        maxLength={MAX_DESCRIPTION_LENGTH}
        placeholder={s.placeholder}
        placeholderTextColor={colors.textMuted}
        textAlignVertical="top"
        style={styles.input}
        testID="description-input"
      />
      <View style={styles.footer}>
        <Text style={styles.count}>{s.count(draft.length, MAX_DESCRIPTION_LENGTH)}</Text>
        <Button label={s.save} onPress={save} compact testID="description-save" />
      </View>
      {saved ? (
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {saved === 'saved' ? s.saved : s.removed}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: theme.colors.textMuted },
  input: {
    ...typography.body,
    minHeight: touchTarget * 3,
    padding: spacing.md,
    borderRadius: radius.md,
    // v11: a filled field like `TextField`.
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  count: { ...typography.caption, color: theme.colors.textMuted },
  status: { ...typography.label, color: theme.colors.textMuted },
}));
