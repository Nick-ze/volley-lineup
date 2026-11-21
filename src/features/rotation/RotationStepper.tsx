import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import type { RotationNumber } from '@/domain/rotation';
import { stepsByLabel } from '@/domain/rotationNames';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { COURT_MAX_WIDTH } from './layout';

export interface RotationStepperProps {
  /** The step shown (1 = the starting six, +1 per clockwise rotation). */
  step: RotationNumber;
  /** The rotation number of every step (index 0 = step 1): the setter's position, or the step. */
  labels: readonly RotationNumber[];
  /** True when the labels follow the setter ("Rotation 4 (setter at position 4)"). */
  bySetter: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (step: RotationNumber) => void;
}

/** Prev / "Rotation n" / Next, plus a 1–6 row to jump straight to a rotation by its number. */
export function RotationStepper({
  step,
  labels,
  bySetter,
  onPrevious,
  onNext,
  onSelect,
}: RotationStepperProps) {
  const t = useT();
  const label = labels[step - 1];
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Button
          label={t.rotation.previous}
          accessibilityLabel={t.rotation.previousLabel}
          variant="secondary"
          compact
          onPress={onPrevious}
          testID="rotation-prev"
        />
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          testID="rotation-title"
        >
          {bySetter
            ? t.rotation.setterRotation(label)
            : t.rotation.rotationOf(label, labels.length)}
        </Text>
        <Button
          label={t.rotation.next}
          accessibilityLabel={t.rotation.nextLabel}
          variant="secondary"
          compact
          onPress={onNext}
          testID="rotation-next"
        />
      </View>
      <View style={styles.steps} accessibilityLabel={t.rotation.stepperLabel}>
        {stepsByLabel(labels).map((s) => (
          <Button
            key={s}
            label={String(labels[s - 1])}
            accessibilityLabel={t.rotation.goToRotation(labels[s - 1])}
            variant={s === step ? 'primary' : 'secondary'}
            compact
            onPress={() => onSelect(s)}
            testID={`rotation-step-${s}`}
            style={styles.step}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, width: '100%', maxWidth: COURT_MAX_WIDTH, alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.subheading, color: colors.text, flexShrink: 1, textAlign: 'center' },
  steps: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'space-between' },
  step: { flex: 1, paddingHorizontal: 0 },
});
