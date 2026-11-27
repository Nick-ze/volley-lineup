import { useCallback, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Banner } from '@/components';
import { fullName } from '@/domain/playerNames';
import { setServeFirst } from '@/domain/lineupEditing';
import type { SetLineup } from '@/domain/types';
import { useT } from '@/i18n';
import { useIsWide } from '@/lib/useIsWide';
import { makeStyles, spacing, typography } from '@/theme';

import { Bench } from './Bench';
import { CopyClearButtons } from './CopyClearButtons';
import { DragProvider } from './drag/DragContext';
import type { DragItem } from './drag/dragTypes';
import { FormationControls } from './FormationControls';
import { LiberoReplaces } from './LiberoReplaces';
import { LiberoSlot } from './LiberoSlot';
import { LineupCourt } from './LineupCourt';
import { PlacementConfirm } from './PlacementConfirm';
import { RotateButtons } from './RotateButtons';
import { ServeToggle } from './ServeToggle';
import { TemplateFill } from './TemplateFill';
import type { LineupDraft } from './useLineupDraft';
import { ValidationPanel } from './ValidationPanel';

export interface LineupBuilderProps {
  editor: LineupDraft;
  /** 'match' (default) shows the serve toggle and "Copy from previous set"; 'preset' hides them. */
  variant?: 'match' | 'preset';
  /** Match sets: the set "Copy from previous set" copies (null = none). */
  previous?: SetLineup | null;
  /** Extra controls shown above the template button (e.g. "Use team starters"). */
  actions?: ReactNode;
}

/**
 * Court + libero slot + bench with drag & drop and tap-to-select for one lineup (a match set or
 * a team preset). Phone: court, then the bench right under it (no scrolling to pick players),
 * then the other controls. Wide: court + controls left, bench right.
 * v10: view only (`editor.viewOnly`) shows the lineup without any editing controls; the screen
 * shows why (ReadOnlyNote).
 */
export function LineupBuilder({
  editor,
  variant = 'match',
  previous = null,
  actions,
}: LineupBuilderProps) {
  const styles = useStyles();
  const t = useT();
  const wide = useIsWide();
  const isMatch = variant === 'match';
  const { set, selectedId, playerById, update, drop, validation, locked, viewOnly } = editor;
  const onDrop = useCallback(
    (item: DragItem, target: Parameters<typeof drop>[1]) => drop(item.player.id, target),
    [drop],
  );
  const selected = playerById(selectedId);

  const lockedNotice =
    locked && !viewOnly ? (
      <Banner alert testID="lineup-locked">
        {t.live.lineupLocked}
      </Banner>
    ) : null;
  const hint = viewOnly ? null : (
    <Text style={styles.hint} accessibilityLiveRegion="polite">
      {selected
        ? t.lineup.selected(`${selected.number} ${fullName(selected)}`)
        : locked
          ? t.live.lineupLocked
          : t.lineup.instructions}
    </Text>
  );
  const liberoAndServe = (
    <View style={styles.underCourt}>
      <LiberoSlot editor={editor} compact={!wide} />
      {isMatch ? (
        <View style={styles.controls}>
          <Text style={styles.hint}>{t.lineup.serveLabel}</Text>
          <ServeToggle
            weServeFirst={set.weServeFirst}
            onChange={(v) => update(setServeFirst(set, v))}
            disabled={locked}
          />
        </View>
      ) : null}
    </View>
  );
  const formation = viewOnly ? null : <FormationControls editor={editor} />;
  const rotate = viewOnly ? null : <RotateButtons editor={editor} />;
  const moreControls = viewOnly ? null : (
    <>
      <LiberoReplaces editor={editor} />
      {actions}
      <TemplateFill key={`template-${set.setNumber}`} editor={editor} />
      <CopyClearButtons editor={editor} previous={isMatch ? previous : undefined} />
    </>
  );

  if (!wide) {
    // Phone: court, libero + serve, then the bench right under them (compact sizes), so picking
    // players needs no scrolling; templates, copy/clear and the checks follow below.
    return (
      <DragProvider onDrop={onDrop} disabled={locked} style={styles.layout}>
        {lockedNotice}
        {formation}
        <LineupCourt editor={editor} compact />
        {rotate}
        {liberoAndServe}
        <Bench editor={editor} scrollable={false} compact />
        {hint}
        {moreControls}
        <ValidationPanel result={validation} />
        <PlacementConfirm editor={editor} />
      </DragProvider>
    );
  }

  return (
    <DragProvider onDrop={onDrop} disabled={locked} style={[styles.layout, styles.wide]}>
      <View style={[styles.column, styles.courtColumn]}>
        {lockedNotice}
        {formation}
        <LineupCourt editor={editor} />
        {rotate}
        {liberoAndServe}
        {moreControls}
      </View>
      <View style={[styles.column, styles.benchColumn]}>
        {hint}
        <Bench editor={editor} scrollable />
        <ValidationPanel result={validation} />
      </View>
      <PlacementConfirm editor={editor} />
    </DragProvider>
  );
}

const useStyles = makeStyles((theme) => ({
  layout: { gap: spacing.md },
  wide: { flexDirection: 'row', alignItems: 'stretch' },
  column: { gap: spacing.md },
  courtColumn: { flex: 3 },
  benchColumn: { flex: 2 },
  underCourt: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  controls: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  hint: { ...typography.body, color: theme.colors.textMuted },
}));
