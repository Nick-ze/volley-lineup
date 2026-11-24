/** v9.0: the visual guides around the court (drag, roles, live score, stats). */
import { Text, View } from 'react-native';

import type { Position } from '@/domain/types';
import { useTheme } from '@/theme';

import { Finger, TapVisual } from './TourVisualParts';
import { MINI, useVisualStyles } from './visualStyles';

/** A 5-1 with the setter on 1: front row 4 · 3 · 2, back row 5 · 6 · 1. */
const FRONT: readonly Position[] = ['OPP', 'MB', 'OH'];
const BACK: readonly Position[] = ['OH', 'MB', 'S'];

/** A player chip on the bench, an arrow, and the court spot it goes to. */
export function DragVisual() {
  const styles = useVisualStyles();
  return (
    <View style={styles.row}>
      <View style={[styles.chip, styles.playerChip]}>
        <Text style={styles.playerChipText}>7</Text>
        <Finger />
      </View>
      <Text style={styles.arrow}>→</Text>
      <View style={styles.court}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.courtRow}>
            {[0, 1, 2].map((col) => (
              <View key={col} style={[styles.spot, row === 0 && col === 1 && styles.spotTarget]} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A small court with every spot's role, and the rotate arrow. */
export function CourtVisual() {
  const styles = useVisualStyles();
  const { positionColors } = useTheme();
  const spot = (code: Position, i: number) => (
    <View key={i} style={[styles.chip, { backgroundColor: positionColors[code].bg }]}>
      <Text style={[styles.chipText, { color: positionColors[code].text }]}>{code}</Text>
    </View>
  );
  return (
    <View style={styles.row}>
      <View style={styles.court}>
        <View style={styles.courtRow}>{FRONT.map(spot)}</View>
        <View style={styles.courtRow}>{BACK.map(spot)}</View>
      </View>
      <View style={styles.column}>
        <Text style={styles.arrow}>↻</Text>
        {spot('L', 9)}
      </View>
    </View>
  );
}

/** The score above Point us / Point them (the finger on Point us). */
export function ScoreVisual({ us, them }: { us: string; them: string }) {
  const styles = useVisualStyles();
  return (
    <View style={styles.column}>
      <Text style={styles.score}>12 : 10</Text>
      <View style={styles.row}>
        <TapVisual label={us} />
        <View style={[styles.button, styles.secondaryButton, styles.outlined]}>
          <Text style={[styles.buttonText, styles.secondaryText]} numberOfLines={1}>
            {them}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Points won (orange) and lost (blue) per rotation 1–6. */
const BARS: readonly [number, number][] = [
  [0.8, 0.5],
  [0.6, 0.7],
  [1, 0.4],
  [0.5, 0.6],
  [0.7, 0.3],
  [0.9, 0.6],
];

export function StatsVisual() {
  const styles = useVisualStyles();
  return (
    <View style={styles.row}>
      {BARS.map(([won, lost], i) => (
        <View key={i} style={styles.column}>
          <View style={styles.bars}>
            <View style={[styles.bar, styles.barUs, { height: won * MINI.barMax }]} />
            <View style={[styles.bar, styles.barThem, { height: lost * MINI.barMax }]} />
          </View>
          <Text style={styles.caption}>{i + 1}</Text>
        </View>
      ))}
    </View>
  );
}
