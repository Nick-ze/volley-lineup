import { Text, View } from 'react-native';

import { Button } from '@/components';
import { LAST_QUICK_PAGE } from '@/domain/tour';
import type { TourPage } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { tourSteps } from './steps';
import { closeTips, endTour, showTourStep } from './tourSession';
import { TourSheet } from './TourSheet';
import { TourVisual } from './TourVisual';

/** Diameter of a step dot. */
const DOT = 8;

/**
 * v9.0: a page's tips, one at a time: visual guide, title, text, dots ("Tip 2 of 3"), Back /
 * Next / Got it, and "End tour". Got it (or closing) marks the page seen.
 */
export function TourStepPopup({ page, step }: { page: TourPage; step: number }) {
  const styles = useStyles();
  const t = useT();
  const p = t.tour.popup;
  const quick = useAppStore((s) => s.tourMode === 'quick');
  const steps = tourSteps(t, page);
  const index = Math.min(step, steps.length - 1);
  const tip = steps[index]!;
  const last = index === steps.length - 1;

  return (
    <TourSheet onClose={closeTips} label={tip.title} testID="tour-popup">
      <TourVisual spec={tip.visual} />
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {tip.title}
        </Text>
        {steps.length > 1 ? (
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={p.stepOf(index + 1, steps.length)}
          >
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
      <Text style={styles.text}>{tip.text}</Text>
      {quick && last && page === LAST_QUICK_PAGE ? (
        <Text style={styles.note} testID="tour-quick-done">
          {p.quickDone}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={p.end}
          accessibilityLabel={p.endLabel}
          variant="ghost"
          compact
          onPress={endTour}
          testID="tour-end"
        />
        <View style={styles.nav}>
          {index > 0 ? (
            <Button
              label={p.back}
              accessibilityLabel={p.backLabel}
              variant="secondary"
              compact
              onPress={() => showTourStep(index - 1)}
              testID="tour-back"
            />
          ) : null}
          {last ? (
            <Button
              label={p.done}
              accessibilityLabel={p.doneLabel}
              compact
              onPress={closeTips}
              testID="tour-done"
            />
          ) : (
            <Button
              label={p.next}
              accessibilityLabel={p.nextLabel}
              compact
              onPress={() => showTourStep(index + 1)}
              testID="tour-next"
            />
          )}
        </View>
      </View>
    </TourSheet>
  );
}

const useStyles = makeStyles((theme) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  title: { ...typography.subheading, color: theme.colors.text, flexShrink: 1 },
  dots: { flexDirection: 'row', gap: spacing.xs, marginLeft: 'auto' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.round,
    backgroundColor: theme.colors.border,
  },
  dotActive: { backgroundColor: theme.colors.primaryText },
  text: { ...typography.body, color: theme.colors.text },
  note: { ...typography.body, color: theme.colors.highlightText, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nav: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
}));
