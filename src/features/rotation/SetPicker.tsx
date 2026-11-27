import { Pressable, Text, View } from 'react-native';

import type { SetNumber } from '@/domain/types';
import { useTrackStyles } from '@/components';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

export interface SetPickerProps {
  sets: readonly SetNumber[];
  selected: SetNumber;
  onSelect: (set: SetNumber) => void;
}

/** Tabs for the sets that exist in the match. The selected set is yellow. */
export function SetPicker({ sets, selected, onSelect }: SetPickerProps) {
  const styles = useStyles();
  const track = useTrackStyles();
  const t = useT();
  return (
    <View
      style={[track.track, styles.row]}
      accessibilityRole="tablist"
      accessibilityLabel={t.rotation.setPickerLabel}
    >
      {sets.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityLabel={t.rotation.setTabLabel(n)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(n)}
            testID={`set-tab-${n}`}
            style={({ pressed }) => [
              track.segment,
              styles.tab,
              active && track.set,
              pressed && track.pressed,
            ]}
          >
            <Text style={[track.text, styles.label, active && track.setText]}>
              {t.rotation.setTab(n)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// v11: one track like the builder's set tabs, as wide as its sets (the current one is yellow).
// v8: the wide dyslexia font gets tighter tabs so five sets still fit one line at 375 px.
const useStyles = makeStyles((theme) => ({
  row: { alignSelf: 'flex-start', flexWrap: 'wrap', maxWidth: '100%' },
  tab: {
    flexGrow: 0,
    flexBasis: 'auto',
    paddingHorizontal: theme.dyslexiaFont ? spacing.xs : spacing.md,
  },
  label: theme.dyslexiaFont ? { letterSpacing: -0.7 } : {},
}));
