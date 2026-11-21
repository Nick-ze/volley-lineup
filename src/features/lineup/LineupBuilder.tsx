import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { clearLineup, copyLineup, setServeFirst } from '@/domain/lineupEditing';
import { useT } from '@/i18n';
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
 * Phone: court, then the bench right under it (no scrolling to pick players), then the other
 * controls. Wide: court + controls left, bench right.
 */
export function LineupBuilder({ editor }: { editor: LineupEditor }) {
  const t = useT();
  const wide = useIsWide();
  const { set, previous, selectedId, playerById, update, drop, validation, locked } = editor;
  const onDrop = useCallback(
    (item: DragItem, target: Parameters<typeof drop>[1]) => drop(item.player.id, target),
    [drop],
  );
  const selected = playerById(selectedId);

  const lockedNotice = locked ? (
    <Text style={styles.locked} accessibilityRole="alert" testID="lineup-locked">
      {t.live.lineupLocked}
    </Text>
  ) : null;
  const hint = (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {selected
        ? t.lineup.selected(`${selected.number} ${selected.firstName} ${selected.lastName}`)
        : locked
          ? t.live.lineupLocked
          : t.lineup.instructions}
    </Text>
  );
  const liberoAndServe = (
    <View style={styles.underCourt}>
      <LiberoSlot editor={editor} compact={!wide} />
      <View style={styles.controls}>
        <Text style={styles.hint}>{t.lineup.serveLabel}</Text>
        <ServeToggle
          weServeFirst={set.weServeFirst}
          onChange={(v) => update(setServeFirst(set, v))}
          disabled={locked}
        />
      </View>
    </View>
  );
  const moreControls = (
    <>
      <LiberoReplaces editor={editor} />
      <TemplateFill key={set.setNumber} editor={editor} />
      <View style={styles.buttons}>
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
    </>
  );

  if (!wide) {
    // Phone: court, libero + serve, then the bench right under them (compact sizes), so picking
    // players needs no scrolling; templates, copy/clear and the checks follow below.
    return (
      <DragProvider onDrop={onDrop} disabled={locked} style={styles.layout}>
        {lockedNotice}
        <LineupCourt editor={editor} compact />
        {liberoAndServe}
        <Bench editor={editor} scrollable={false} compact />
        {hint}
        {moreControls}
        <ValidationPanel result={validation} />
      </DragProvider>
    );
  }

  return (
    <DragProvider onDrop={onDrop} disabled={locked} style={[styles.layout, styles.wide]}>
      <View style={[styles.column, styles.courtColumn]}>
        {lockedNotice}
        <LineupCourt editor={editor} />
        {liberoAndServe}
        {moreControls}
      </View>
      <View style={[styles.column, styles.benchColumn]}>
        {hint}
        <Bench editor={editor} scrollable />
        <ValidationPanel result={validation} />
      </View>
    </DragProvider>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.md },
  wide: { flexDirection: 'row', alignItems: 'stretch' },
  column: { gap: spacing.md },
  courtColumn: { flex: 3 },
  benchColumn: { flex: 2 },
  underCourt: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  controls: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  hint: { ...typography.body, color: colors.textMuted },
  locked: { ...typography.body, color: colors.highlight },
});
