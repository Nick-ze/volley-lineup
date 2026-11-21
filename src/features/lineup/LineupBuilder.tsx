import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { clearLineup, copyLineup, setServeFirst } from '@/domain/lineupEditing';
import { t } from '@/i18n/en';
import { useIsWide } from '@/lib/useIsWide';
import { colors, spacing, typography } from '@/theme';

import { Bench } from './Bench';
import { DragProvider, type DragItem } from './drag/DragContext';
import { LiberoReplaces } from './LiberoReplaces';
import { LiberoSlot } from './LiberoSlot';
import { LineupCourt } from './LineupCourt';
import { ServeToggle } from './ServeToggle';
import { TemplateFill } from './TemplateFill';
import type { LineupEditor } from './useLineupEditor';
import { ValidationPanel } from './ValidationPanel';

/**
 * Court + libero slot + bench with drag & drop and tap-to-select for one set.
 * Phone: court on top, bench below. Wide: court left, bench right.
 */
export function LineupBuilder({ editor }: { editor: LineupEditor }) {
  const wide = useIsWide();
  const { set, previous, selectedId, playerById, update, drop, validation } = editor;
  const onDrop = useCallback(
    (item: DragItem, target: Parameters<typeof drop>[1]) => drop(item.player.id, target),
    [drop],
  );
  const selected = playerById(selectedId);

  return (
    <DragProvider onDrop={onDrop} style={[styles.layout, wide && styles.wide]}>
      <View style={[styles.column, wide && styles.courtColumn]}>
        <LineupCourt editor={editor} />
        <View style={styles.underCourt}>
          <LiberoSlot editor={editor} />
          <View style={styles.controls}>
            <Text style={styles.hint}>{t.lineup.serveLabel}</Text>
            <ServeToggle
              weServeFirst={set.weServeFirst}
              onChange={(v) => update(setServeFirst(set, v))}
            />
          </View>
        </View>
        <LiberoReplaces editor={editor} />
        <TemplateFill key={set.setNumber} editor={editor} />
        <View style={styles.buttons}>
          <Button
            label={t.lineup.copyPrevious}
            accessibilityHint={t.lineup.copyPreviousHint}
            variant="secondary"
            compact
            disabled={previous === null}
            onPress={() => {
              if (previous) update(copyLineup(previous, set.setNumber, set.weServeFirst));
            }}
            testID="copy-previous"
            style={styles.grow}
          />
          <Button
            label={t.lineup.clear}
            accessibilityLabel={t.lineup.clearLabel}
            variant="danger"
            compact
            onPress={() => update(clearLineup(set))}
            testID="clear-lineup"
          />
        </View>
      </View>
      <View style={[styles.column, wide && styles.benchColumn]}>
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {selected
            ? t.lineup.selected(`${selected.number} ${selected.firstName} ${selected.lastName}`)
            : t.lineup.instructions}
        </Text>
        <Bench editor={editor} scrollable={wide} />
        <ValidationPanel result={validation} />
      </View>
    </DragProvider>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.lg },
  wide: { flexDirection: 'row', alignItems: 'stretch' },
  column: { gap: spacing.md },
  courtColumn: { flex: 3 },
  benchColumn: { flex: 2 },
  underCourt: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  controls: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  hint: { ...typography.body, color: colors.textMuted },
});
