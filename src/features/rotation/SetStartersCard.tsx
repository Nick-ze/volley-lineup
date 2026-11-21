import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { formationRotation, isOffPosition, spotRoles } from '@/domain/roles';
import {
  COURT_POSITIONS,
  type CourtPosition,
  type Player,
  type Position,
  type SetLineup,
  type SetNumber,
} from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import { STARTERS_CARD_WIDTH } from './layout';
import { RotationCourt } from './RotationCourt';
import { SetInfo } from './SetInfo';

export interface SetStartersCardProps {
  set: SetLineup;
  playersById: Map<string, Player>;
  onOpen: (set: SetNumber) => void;
}

/** Screen-reader label: the card is one button, so it must say what it shows. */
export function startersCardLabel(
  t: Strings,
  set: SetLineup,
  playersById: Map<string, Player>,
  roles: Readonly<Record<CourtPosition, Position>>,
): string {
  const describe = (id: string | null, role: Position | null) => {
    const roleName = role ? t.positions[role] : null;
    if (id === null)
      return roleName ? `${t.rotation.emptySummary} (${roleName})` : t.rotation.emptySummary;
    const p = playersById.get(id);
    if (!p) return t.rotation.unknownPlayer;
    const summary = t.rotation.playerSummary(p.number, `${p.firstName} ${p.lastName}`.trim());
    return role
      ? `${summary}, ${t.roles.spotRole(t.positions[role], isOffPosition(p, role))}`
      : summary;
  };
  const starters = COURT_POSITIONS.map((pos) =>
    t.rotation.starterSummary(pos, describe(set.slots[pos], roles[pos])),
  ).join(', ');
  const libero = set.liberoId === null ? t.rotation.noLibero : describe(set.liberoId, null);
  const serve = set.weServeFirst ? t.rotation.weServeFirst : t.rotation.weReceiveFirst;
  const card = t.rotation.cardLabel(set.setNumber, starters, libero, serve);
  return `${card} ${t.rotation.setterRotation(formationRotation(set.formation))}.`;
}

/**
 * Compact starting six (with the formation's role on every spot and the rotation named after the
 * setter spot) + libero + serve info for one set. Tapping opens its rotations.
 */
export function SetStartersCard({ set, playersById, onOpen }: SetStartersCardProps) {
  const t = useT();
  const roles = useMemo(() => spotRoles(set.formation), [set.formation]);
  const rotation = formationRotation(set.formation);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={startersCardLabel(t, set, playersById, roles)}
      accessibilityHint={t.rotation.openRotationHint}
      onPress={() => onOpen(set.setNumber)}
      testID={`starters-card-${set.setNumber}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{t.rotation.setTab(set.setNumber)}</Text>
      <Text style={styles.rotation} testID={`starters-rotation-${set.setNumber}`}>
        {t.rotation.setterRotation(rotation)}
      </Text>
      <RotationCourt slots={set.slots} playersById={playersById} spotRoles={roles} compact />
      <SetInfo
        libero={set.liberoId ? playersById.get(set.liberoId) : undefined}
        liberoId={set.liberoId}
        weServeFirst={set.weServeFirst}
        compact
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: STARTERS_CARD_WIDTH,
    maxWidth: '100%',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { borderColor: colors.highlight },
  title: { ...typography.subheading, color: colors.highlight },
  rotation: { ...typography.label, color: colors.textMuted },
});
