import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TeamAvatar } from '@/components';
import { seasonOverview } from '@/domain/stats';
import type { Match, Season } from '@/domain/types';
import { useT } from '@/i18n';
import { useTeam } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { KindBadge } from './KindBadge';
import { seasonSummary, seasonWhenWhere } from './seasonText';

/** v8: size of the team picture on a season box. */
const SEASON_TEAM_AVATAR = touchTarget;

export interface SeasonCardProps {
  season: Season;
  /** The season's matches. */
  matches: readonly Match[];
  onPress: () => void;
}

/** A season "box" (v11: a flat panel): kind, name, dates / place and "5 matches · 3–1". */
export function SeasonCard({ season, matches, onPress }: SeasonCardProps) {
  const styles = useStyles();
  const t = useT();
  const team = useTeam(season.teamId);
  const overview = useMemo(() => seasonOverview(matches), [matches]);
  const whenWhere = seasonWhenWhere(t, season);
  const summary = seasonSummary(t, matches.length, overview);
  const kind = t.seasons.kind[season.kind];
  // In the order shown (v11: the kind stands above the name), so the label starts with the text.
  const spoken = [kind, season.name, whenWhere, summary].filter((x) => x !== '').join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.seasons.list.open(spoken)}
      onPress={onPress}
      testID={`season-${season.id}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        {team ? <TeamAvatar team={team} size={SEASON_TEAM_AVATAR} /> : null}
        <View style={styles.title}>
          <KindBadge kind={season.kind} />
          <Text style={styles.name} numberOfLines={2}>
            {season.name}
          </Text>
        </View>
      </View>
      {whenWhere !== '' ? <Text style={styles.meta}>{whenWhere}</Text> : null}
      <Text style={styles.summary} testID="season-summary">
        {summary}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    minHeight: touchTarget * 2,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, gap: spacing.xxs },
  name: { ...typography.subheading, color: theme.colors.text },
  meta: { ...typography.label, color: theme.colors.textMuted },
  summary: { ...typography.body, color: theme.colors.text },
}));
