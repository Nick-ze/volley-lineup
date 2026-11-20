import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { ROTATION_COUNT, ROTATION_NUMBERS, type RotationNumber } from '@/domain/rotation';
import { t } from '@/i18n/en';
import { colors, spacing, typography } from '@/theme';

import { COURT_MAX_WIDTH } from './layout';

export interface RotationStepperProps {
  rotation: RotationNumber;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (n: RotationNumber) => void;
}

/** Prev / "Rotation n of 6" / Next, plus a 1–6 row to jump straight to a rotation. */
export function RotationStepper({ rotation, onPrevious, onNext, onSelect }: RotationStepperProps) {
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
        <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
          {t.rotation.rotationOf(rotation, ROTATION_COUNT)}
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
        {ROTATION_NUMBERS.map((n) => (
          <Button
            key={n}
            label={String(n)}
            accessibilityLabel={t.rotation.goToRotation(n)}
            variant={n === rotation ? 'primary' : 'secondary'}
            compact
            onPress={() => onSelect(n)}
            testID={`rotation-step-${n}`}
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
