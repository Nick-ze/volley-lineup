import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components';
import { MAX_DESCRIPTION_LENGTH, normalizeDescription } from '@/domain/photos';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

/** Lines of text the field shows before it scrolls. */
const FIELD_LINES = 5;

/**
 * Edit one player's confidential description. Only rendered while descriptions are unlocked.
 * Saving a blank text removes the description.
 */
export function DescriptionEditor({ player }: { player: Player }) {
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

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { ...typography.label, color: colors.textMuted },
  input: {
    ...typography.body,
    minHeight: touchTarget * 3,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  count: { ...typography.caption, color: colors.textMuted },
  status: { ...typography.label, color: colors.textMuted },
});
