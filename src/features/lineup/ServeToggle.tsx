import { Pressable, Text, View } from 'react-native';

import { useTrackStyles } from '@/components';
import { useT } from '@/i18n';

/** Two-option switch: we serve first / opponent serves first. */
export function ServeToggle({
  weServeFirst,
  onChange,
  disabled = false,
  onPanel = false,
}: {
  weServeFirst: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
  /** v11: inside a panel (the next-set setup): the track is a darker well. */
  onPanel?: boolean;
}) {
  const styles = useTrackStyles();
  const t = useT();
  const option = (value: boolean, label: string, testID: string) => {
    const active = weServeFirst === value;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: active, disabled }}
        // react-native-web ignores accessibilityState: expose the state with aria-* too.
        aria-checked={active}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => onChange(value)}
        style={[styles.segment, active && (disabled ? styles.locked : styles.choice)]}
        testID={testID}
      >
        <Text style={[styles.text, disabled ? styles.textMuted : active && styles.choiceText]}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      style={[styles.track, onPanel && styles.trackOnPanel]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t.lineup.serveLabel}
    >
      {option(true, t.lineup.weServe, 'serve-us')}
      {option(false, t.lineup.theyServe, 'serve-them')}
    </View>
  );
}
