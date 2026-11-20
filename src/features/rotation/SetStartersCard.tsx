import { Pressable, StyleSheet, Text } from 'react-native';

import type { Player, SetLineup, SetNumber } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

import { RotationCourt } from './RotationCourt';
import { SetInfo } from './SetInfo';

export interface SetStartersCardProps {
  set: SetLineup;
  playersById: Map<string, Player>;
  onOpen: (set: SetNumber) => void;
}

export const STARTERS_CARD_WIDTH = 300;

/** Compact starting six + libero + serve info for one set. Tapping opens its rotations. */
export function SetStartersCard({ set, playersById, onOpen }: SetStartersCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.rotation.openRotation(set.setNumber)}
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
