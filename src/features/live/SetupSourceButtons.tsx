import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { SetupSources } from '@/domain/matchFlow';
import { presetFromSet, type PresetLineup } from '@/domain/presets';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

export interface SetupSourceButtonsProps {
  sources: SetupSources;
  onFill: (lineup: PresetLineup) => void;
}

/** "Fill from": team starters, a copy of the previous set, each preset (or a hint if none). */
export function SetupSourceButtons({ sources, onFill }: SetupSourceButtonsProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.live.setup;
  const { starters, presets, previous } = sources;
  if (!starters && !previous && presets.length === 0) {
    return <Text style={styles.text}>{s.nothing}</Text>;
  }
  return (
    <>
      <Text style={styles.label}>{s.fillFrom}</Text>
      <View style={styles.row}>
        {starters ? (
          <Button
            label={s.starters}
            accessibilityLabel={s.startersLabel}
            variant="secondary"
            compact
            onPress={() => onFill(starters)}
            testID="setup-starters"
          />
        ) : null}
        {previous ? (
          <Button
            label={s.copy(previous.setNumber)}
            accessibilityLabel={s.copyLabel(previous.setNumber)}
            variant="secondary"
            compact
            onPress={() => onFill(presetFromSet(previous))}
            testID="setup-copy"
          />
        ) : null}
        {presets.map((p) => (
          <Button
            key={p.id}
            label={p.name}
            accessibilityLabel={s.presetLabel(p.name)}
            variant="secondary"
            compact
            onPress={() => onFill(p)}
            testID={`setup-preset-${p.name}`}
          />
        ))}
      </View>
    </>
  );
}

const useStyles = makeStyles((theme) => ({
  label: { ...typography.label, color: theme.colors.textMuted },
  text: { ...typography.body, color: theme.colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
