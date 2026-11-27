import { Pressable, Text, View } from 'react-native';

import { SET_NUMBERS, type SetNumber } from '@/domain/types';
import { useTrackStyles } from '@/components';
import { useT } from '@/i18n';

export interface SetTabsProps {
  selected: SetNumber;
  /** Sets that already have a saved lineup (the others are shown in grey). */
  existing: SetNumber[];
  onSelect(n: SetNumber): void;
}

/** Tabs for sets 1–5 (v11: one track). The selected set is yellow. */
export function SetTabs({ selected, existing, onSelect }: SetTabsProps) {
  const styles = useTrackStyles();
  const t = useT();
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={t.lineup.setTabs}>
      {SET_NUMBERS.map((n) => {
        const active = n === selected;
        return (
          <Pressable
            key={n}
            accessibilityRole="tab"
            accessibilityLabel={t.lineup.setTab(n)}
            accessibilityHint={t.lineup.setTabHint}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(n)}
            style={[styles.segment, active && styles.set]}
            testID={`set-tab-${n}`}
          >
            <Text
              style={[
                styles.text,
                !existing.includes(n) && styles.textMuted,
                active && styles.setText,
              ]}
            >
              {t.lineup.setTab(n)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
