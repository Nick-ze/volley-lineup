import { Pressable, Text } from 'react-native';

import { Button, Dialog, useDialogStyles } from '@/components';
import type { TourMode } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { cancelTourChoice, chooseTour } from './tourSession';

const MODES: readonly TourMode[] = ['full', 'quick', 'none'];

/** The tour's name and one-line description. */
export function tourModeText(t: Strings, mode: TourMode): { name: string; hint: string } {
  const c = t.tour.choice;
  switch (mode) {
    case 'full':
      return { name: c.full, hint: c.fullHint };
    case 'quick':
      return { name: c.quick, hint: c.quickHint };
    case 'none':
      return { name: c.none, hint: c.noneHint };
  }
}

/**
 * v9.0: "Full tour · Quick tour · No tour". Asked once on the first start (`current` null: no
 * Cancel, the back button keeps asking) and from Profile (shows the tour that is on now, with
 * Cancel). Choosing starts the tour over.
 */
export function TourChoiceDialog({ current }: { current: TourMode | null }) {
  const styles = useStyles();
  const dialog = useDialogStyles();
  const t = useT();
  const c = t.tour.choice;
  const again = current !== null;
  return (
    <Dialog
      onClose={again ? cancelTourChoice : () => {}}
      title={again ? c.titleAgain : c.title}
      testID="tour-choice"
      cardProps={{ role: 'dialog', 'aria-modal': true }}
    >
      <Text style={dialog.message}>{c.intro}</Text>
      {again ? (
        <Text style={styles.current}>{c.current(tourModeText(t, current).name)}</Text>
      ) : null}
      {MODES.map((mode) => {
        const { name, hint } = tourModeText(t, mode);
        const active = mode === current;
        return (
          <Pressable
            key={mode}
            accessibilityRole="button"
            accessibilityLabel={c.optionLabel(name, active ? `${hint} (${c.chosen})` : hint)}
            onPress={() => chooseTour(mode)}
            style={({ pressed }) => [
              styles.option,
              active && styles.active,
              pressed && styles.pressed,
            ]}
            testID={`tour-choose-${mode}`}
          >
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.hint}>{hint}</Text>
          </Pressable>
        );
      })}
      {again ? (
        <Button
          label={c.cancel}
          accessibilityLabel={c.cancelLabel}
          variant="ghost"
          onPress={cancelTourChoice}
          style={styles.cancel}
          testID="tour-choice-cancel"
        />
      ) : null}
    </Dialog>
  );
}

const useStyles = makeStyles((theme) => ({
  current: { ...typography.label, color: theme.colors.highlightText },
  option: {
    minHeight: touchTarget,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.colors.surfaceRaised,
  },
  // v11: the current choice is soft orange, like every selected option.
  active: { backgroundColor: theme.colors.primarySoft },
  pressed: { opacity: 0.8 },
  name: { ...typography.subheading, color: theme.colors.text },
  hint: { ...typography.body, color: theme.colors.textMuted },
  cancel: { alignSelf: 'flex-end' },
}));
