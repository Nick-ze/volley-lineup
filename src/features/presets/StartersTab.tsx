import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { emptySetLineup } from '@/domain/lineup';
import { applyPresetToSet, filledCount, isPresetComplete } from '@/domain/presets';
import { isOffPosition, startingRoles } from '@/domain/roles';
import { COURT_POSITIONS, type Player, type RoleOverrides } from '@/domain/types';
import { RotationCourt } from '@/features/rotation';
import { listStyles } from '@/features/roster/components/styles';
import { useT, type Strings } from '@/i18n';
import { usePlayersForTeam, useStarters } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

export interface StartersTabProps {
  teamId: string;
  onEdit: () => void;
}

/** The compact court (max 340 px) plus the card padding. */
const CARD_MAX_WIDTH = 360;

const playerName = (p: Player) => `#${p.number} ${p.firstName} ${p.lastName}`.trim();

/** Screen-reader summary of the starters court: "Position 1: #7 Ana Ace, …". */
function courtSummary(
  t: Strings,
  slots: Record<number, string | null>,
  byId: Map<string, Player>,
  roles: Readonly<RoleOverrides>,
) {
  return COURT_POSITIONS.map((pos) => {
    const id = slots[pos];
    const p = id ? byId.get(id) : undefined;
    if (!p) return t.rotation.starterSummary(pos, t.rotation.emptySummary);
    const role = roles[p.id];
    const desc = role
      ? `${playerName(p)}, ${t.roles.spotRole(t.positions[role], isOffPosition(p, role))}`
      : playerName(p);
    return t.rotation.starterSummary(pos, desc);
  }).join(', ');
}

/** The team's starting six + libero on a compact court, with "Set / Edit starters". */
export function StartersTab({ teamId, onEdit }: StartersTabProps) {
  const t = useT();
  const s = t.presets.starters;
  const starters = useStarters(teamId);
  const players = usePlayersForTeam(teamId);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  if (!starters) {
    return (
      <View style={styles.wrap}>
        <Text style={listStyles.empty}>{s.empty}</Text>
        <Button
          label={s.set}
          accessibilityLabel={s.setLabel}
          onPress={onEdit}
          testID="edit-starters"
        />
      </View>
    );
  }

  const libero = starters.liberoId ? byId.get(starters.liberoId) : undefined;
  // v4: the role every starter plays (overrides from the starters, else the primary position).
  const roles = startingRoles(
    { ...emptySetLineup(1), slots: starters.slots, roles: starters.roles },
    players,
  );
  const complete = isPresetComplete(starters);
  // Injured (inactive) starters are skipped when a new match is pre-filled.
  const leftOut = applyPresetToSet(emptySetLineup(1), starters, players).skipped.length;
  const status = !complete
    ? s.incomplete(filledCount(starters))
    : leftOut > 0
      ? s.leftOut(leftOut)
      : s.complete;
  return (
    <View style={styles.wrap}>
      <View style={listStyles.headerRow}>
        <Text style={listStyles.heading} accessibilityRole="header">
          {s.heading}
        </Text>
        <Button
          label={s.edit}
          accessibilityLabel={s.editLabel}
          onPress={onEdit}
          compact
          testID="edit-starters"
        />
      </View>
      <View
        style={styles.card}
        accessible
        accessibilityLabel={s.courtLabel(courtSummary(t, starters.slots, byId, roles))}
        testID="starters-court"
      >
        <RotationCourt slots={starters.slots} playersById={byId} roles={roles} compact />
        <Text style={styles.libero}>{libero ? s.libero(playerName(libero)) : s.noLibero}</Text>
      </View>
      <Text
        style={[styles.status, (!complete || leftOut > 0) && styles.warn]}
        testID="starters-status"
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  libero: { ...typography.body, color: colors.text, textAlign: 'center' },
  status: { ...typography.body, color: colors.textMuted },
  warn: { color: colors.highlight },
});
