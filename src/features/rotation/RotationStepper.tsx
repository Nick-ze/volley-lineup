import { Pressable, Text, View } from 'react-native';

import { IconButton, useTrackStyles } from '@/components';
import type { RotationNumber } from '@/domain/rotation';
import { stepsByLabel } from '@/domain/formationSteps';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { COURT_MAX_WIDTH } from './layout';

export interface RotationStepperProps {
  /** The step shown (1 = the starting six, +1 per clockwise rotation). */
  step: RotationNumber;
  /** The rotation number of every step (index 0 = step 1): the setter spot in that step. */
  labels: readonly RotationNumber[];
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (step: RotationNumber) => void;
}

/**
 * Prev / "Rotation n" / Next, plus a 1–6 row to jump straight to a rotation by its number. v11:
 * round arrow buttons, the numbers as one track.
 */
export function RotationStepper({
  step,
  labels,
  onPrevious,
  onNext,
  onSelect,
}: RotationStepperProps) {
  const styles = useStyles();
  const track = useTrackStyles();
  const t = useT();
  const label = labels[step - 1];
  /** For a number that comes up twice (6-2): ", second time" etc.; '' otherwise. */
  const repeat = (s: RotationNumber) => {
    const n = labels[s - 1];
    if (labels.filter((l) => l === n).length < 2) return '';
    return `, ${t.rotation.repeat(labels.slice(0, s).filter((l) => l === n).length)}`;
  };
  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <IconButton
          icon="chevron-back"
          shape="round"
          accessibilityLabel={t.rotation.previousLabel}
          onPress={onPrevious}
          testID="rotation-prev"
        />
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          testID="rotation-title"
        >
          {`${t.rotation.setterRotation(label)}${repeat(step)}`}
        </Text>
        <IconButton
          icon="chevron-forward"
          shape="round"
          accessibilityLabel={t.rotation.nextLabel}
          onPress={onNext}
          testID="rotation-next"
        />
      </View>
      <View style={track.track} accessibilityLabel={t.rotation.stepperLabel}>
        {stepsByLabel(labels).map((s) => {
          const active = s === step;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityLabel={`${t.rotation.goToRotation(labels[s - 1])}${repeat(s)}`}
              accessibilityState={{ selected: active }}
              aria-current={active ? 'step' : undefined}
              onPress={() => onSelect(s)}
              testID={`rotation-step-${s}`}
              style={({ pressed }) => [
                track.segment,
                active && track.choice,
                pressed && track.pressed,
              ]}
            >
              <Text style={[track.text, active && track.choiceText]}>{labels[s - 1]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm, width: '100%', maxWidth: COURT_MAX_WIDTH, alignSelf: 'center' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.displayM, color: theme.colors.text, flex: 1, textAlign: 'center' },
}));
