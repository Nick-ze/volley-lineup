import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { seasonOverview } from '@/domain/stats';
import type { Match, Season } from '@/domain/types';
import { useT } from '@/i18n';
import { borderWidth, colors, radius, spacing, touchTarget, typography } from '@/theme';

import { KindBadge } from './KindBadge';
import { seasonSummary, seasonWhenWhere } from './seasonText';

export interface SeasonCardProps {
  season: Season;
  /** The season's matches. */
  matches: readonly Match[];
  onPress: () => void;
}

/** A season "box": name, kind, dates / place and "5 matches · 3–1". */
export function SeasonCard({ season, matches, onPress }: SeasonCardProps) {
  const t = useT();
  const overview = useMemo(() => seasonOverview(matches), [matches]);
  const whenWhere = seasonWhenWhere(t, season);
  const summary = seasonSummary(t, matches.length, overview);
  const kind = t.seasons.kind[season.kind];
  const spoken = [season.name, kind, whenWhere, summary].filter((x) => x !== '').join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.seasons.list.open(spoken)}
      onPress={onPress}
      testID={`season-${season.id}`}
      style={({ pressed }) => [
        styles.card,
        season.kind === 'tournament' && styles.tournament,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={2}>
          {season.name}
        </Text>
        <KindBadge kind={season.kind} />
      </View>
      {whenWhere !== '' ? <Text style={styles.meta}>{whenWhere}</Text> : null}
      <Text style={styles.summary} testID="season-summary">
        {summary}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: touchTarget * 2,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: borderWidth.thick,
    borderLeftColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  tournament: { borderLeftColor: colors.secondary },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  name: { ...typography.subheading, color: colors.text, flex: 1 },
  meta: { ...typography.label, color: colors.textMuted },
  summary: { ...typography.body, color: colors.text },
});
