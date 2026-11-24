/** v9.0: the visual guides of controls (tap, list row, form, switch, chips, swipe). */
import { Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { useTheme } from '@/theme';

import { useVisualStyles } from './visualStyles';

/** The finger marker on the control to press. */
export function Finger() {
  const styles = useVisualStyles();
  return <View style={styles.finger} />;
}

export function TapVisual({ label }: { label: string }) {
  const styles = useVisualStyles();
  return (
    <View style={styles.button}>
      <Text style={styles.buttonText} numberOfLines={1}>
        {label}
      </Text>
      <Finger />
    </View>
  );
}

export function RowVisual({ label }: { label: string }) {
  const styles = useVisualStyles();
  return (
    <View style={styles.listRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{label.slice(0, 1)}</Text>
      </View>
      <Text style={styles.rowText} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.muted}>›</Text>
      <Finger />
    </View>
  );
}

export function FormVisual({
  field,
  value,
  button,
}: {
  field: string;
  value: string;
  button: string;
}) {
  const styles = useVisualStyles();
  return (
    <View style={styles.column}>
      <View style={styles.field}>
        <Text style={styles.caption} numberOfLines={1}>
          {field}
        </Text>
        <Text style={styles.fieldText} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <TapVisual label={button} />
    </View>
  );
}

export function ToggleVisual({ label }: { label: string }) {
  const styles = useVisualStyles();
  return (
    <View style={[styles.row, styles.listRow]}>
      <Text style={styles.toggleText} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={styles.thumb} />
      </View>
      <Finger />
    </View>
  );
}

export function ChipsVisual({ items }: { items: readonly Position[] }) {
  const styles = useVisualStyles();
  const { positionColors } = useTheme();
  return (
    <View style={styles.row}>
      {items.map((code, i) => (
        <View
          key={code}
          style={[
            styles.chip,
            { backgroundColor: positionColors[code].bg },
            i === 0 && styles.primaryRing,
          ]}
        >
          <Text style={[styles.chipText, { color: positionColors[code].text }]}>{code}</Text>
          {i === 0 ? <Finger /> : null}
        </View>
      ))}
    </View>
  );
}

export function SwipeVisual({ tabs }: { tabs: readonly string[] }) {
  const styles = useVisualStyles();
  return (
    <View style={styles.column}>
      <View style={styles.row}>
        {tabs.map((tab, i) => (
          <Text key={tab} style={[styles.tab, i === 0 && styles.tabActive]} numberOfLines={1}>
            {tab}
          </Text>
        ))}
      </View>
      <Text style={styles.arrow}>← →</Text>
    </View>
  );
}
