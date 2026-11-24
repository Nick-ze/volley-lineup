import { Text } from 'react-native';

import { Button } from '@/components';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import { makeStyles, typography } from '@/theme';

import { tourModeText } from './TourChoiceDialog';
import { openTourChoice } from './tourSession';

/** v9.0 Profile tab "Tutorial": the tour that is on, and "Choose again" (full, quick or none). */
export function TourSection() {
  const styles = useStyles();
  const t = useT();
  const tp = t.tour.profile;
  const mode = useAppStore((s) => s.tourMode);
  return (
    <Section title={tp.title} hint={tp.hint}>
      <Text style={styles.current}>
        {t.tour.choice.current(mode === null ? tp.notChosen : tourModeText(t, mode).name)}
      </Text>
      <Button
        label={tp.button}
        accessibilityLabel={tp.buttonLabel}
        variant="secondary"
        onPress={openTourChoice}
        testID="tour-choose-again"
      />
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  current: { ...typography.label, color: theme.colors.text },
}));
