import { StyleSheet, View } from 'react-native';

import { Button } from '@/components';
import { clearLineup, copyLineup } from '@/domain/lineupEditing';
import type { SetLineup } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

export interface CopyClearButtonsProps {
  editor: LineupDraft;
  /** The set to copy from; `undefined` hides "Copy from previous set" (presets). */
  previous?: SetLineup | null;
}

/** "Copy from previous set" (match sets only) and "Clear". */
export function CopyClearButtons({ editor, previous }: CopyClearButtonsProps) {
  const t = useT();
  const { set, update, locked } = editor;
  return (
    <View style={styles.buttons}>
      {previous !== undefined ? (
        <Button
          label={t.lineup.copyPrevious}
          accessibilityHint={t.lineup.copyPreviousHint}
          variant="secondary"
          compact
          disabled={previous === null || locked}
          onPress={() => {
            if (previous) update(copyLineup(previous, set.setNumber, set.weServeFirst));
          }}
          testID="copy-previous"
          style={styles.grow}
        />
      ) : null}
      <Button
        label={t.lineup.clear}
        accessibilityLabel={t.lineup.clearLabel}
        variant="danger"
        compact
        disabled={locked}
        onPress={() => update(clearLineup(set))}
        testID="clear-lineup"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  grow: { flex: 1 },
});
