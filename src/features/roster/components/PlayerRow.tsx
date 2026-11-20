import { StyleSheet, Text, View } from 'react-native';

import { Button, PositionBadge } from '@/components';
import type { Player } from '@/domain/types';
import { t } from '@/i18n/en';
import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { ListRow } from './ListRow';

export interface PlayerRowProps {
  player: Player;
  onPress: () => void;
  onToggleActive: () => void;
}

/** One roster line: number, name, position badges and the active / injured toggle. */
export function PlayerRow({ player, onPress, onToggleActive }: PlayerRowProps) {
  const name = `${player.firstName} ${player.lastName}`;
  const s = t.roster.roster;
  const positions = player.positions.map((p) => t.positions[p]).join(', ');
  return (
    <ListRow
      title={name}
      onPress={onPress}
      accessibilityLabel={s.rowLabel(player.number, name, positions, player.active)}
      testID={`player-${player.number}`}
      leading={
        <View style={[styles.number, !player.active && styles.numberInactive]}>
          <Text style={[styles.numberText, !player.active && styles.numberTextInactive]}>
            {player.number}
          </Text>
        </View>
      }
      subtitle={
        <View style={styles.badges}>
          {player.positions.map((p) => (
            <PositionBadge key={p} position={p} />
          ))}
        </View>
      }
      actions={
        <Button
          label={player.active ? s.active : s.inactive}
          accessibilityLabel={s.toggleActive(name, player.active)}
          variant={player.active ? 'secondary' : 'danger'}
          compact
          onPress={onToggleActive}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  number: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInactive: { backgroundColor: colors.surfaceRaised },
  numberText: {
    ...typography.subheading,
    fontWeight: typography.jersey.fontWeight,
    color: colors.onPrimary,
  },
  numberTextInactive: { color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
