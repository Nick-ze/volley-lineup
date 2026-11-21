import { Pressable, StyleSheet, Text } from 'react-native';

import { COURT_POSITIONS, type Player, type SetLineup, type SetNumber } from '@/domain/types';
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
): string {
  const describe = (id: string | null) => {
    if (id === null) return t.rotation.emptySummary;
    const p = playersById.get(id);
    return p
      ? t.rotation.playerSummary(p.number, `${p.firstName} ${p.lastName}`.trim())
      : t.rotation.unknownPlayer;
  };
  const starters = COURT_POSITIONS.map((pos) =>
    t.rotation.starterSummary(pos, describe(set.slots[pos])),
  ).join(', ');
  const libero = set.liberoId === null ? t.rotation.noLibero : describe(set.liberoId);
  const serve = set.weServeFirst ? t.rotation.weServeFirst : t.rotation.weReceiveFirst;
  return t.rotation.cardLabel(set.setNumber, starters, libero, serve);
}

/** Compact starting six + libero + serve info for one set. Tapping opens its rotations. */
export function SetStartersCard({ set, playersById, onOpen }: SetStartersCardProps) {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={startersCardLabel(t, set, playersById)}
      accessibilityHint={t.rotation.openRotationHint}
      onPress={() => onOpen(set.setNumber)}
      testID={`starters-card-${set.setNumber}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{t.rotation.setTab(set.setNumber)}</Text>
      <RotationCourt slots={set.slots} playersById={playersById} compact />
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
});
