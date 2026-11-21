import { StyleSheet, Text, View } from 'react-native';

import { Button, Photo, PositionBadge } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

/** Diameter of the header picture / number circle. */
const HEADER_PHOTO_SIZE = 72;

/** Photo (or jersey number), name, number, positions, status and the Edit button. */
export function PlayerHeader({ player, onEdit }: { player: Player; onEdit: () => void }) {
  const t = useT();
  const name = `${player.firstName} ${player.lastName}`;
  const status = player.active ? t.roster.roster.active : t.roster.roster.inactive;
  const positions = player.positions.map((p) => t.positions[p]).join(', ');
  return (
    <View style={styles.row}>
      <View
        style={styles.main}
        accessible
        accessibilityLabel={t.playerDetail.headerLabel(player.number, name, positions, status)}
        testID="player-header"
      >
        <Photo
          photoId={player.photoId}
          size={HEADER_PHOTO_SIZE}
          fallback={
            <View style={styles.number} testID="player-number-circle">
              <Text style={styles.numberText}>{player.number}</Text>
            </View>
          }
        />
        <View style={styles.text}>
          <Text style={styles.name} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.meta}>
            {t.playerDetail.number(player.number)} ·{' '}
            <Text style={player.active ? styles.active : styles.injured}>{status}</Text>
          </Text>
          <View style={styles.badges}>
            {player.positions.map((p) => (
              <PositionBadge key={p} position={p} />
            ))}
          </View>
        </View>
      </View>
      <Button
        label={t.playerDetail.edit}
        accessibilityLabel={t.playerDetail.editLabel(name)}
        variant="secondary"
        compact
        onPress={onEdit}
        testID="player-edit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: {
    width: HEADER_PHOTO_SIZE,
    height: HEADER_PHOTO_SIZE,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { ...typography.jersey, color: colors.onPrimary },
  text: { flex: 1, gap: spacing.xs },
  name: { ...typography.subheading, color: colors.text },
  meta: { ...typography.body, color: colors.textMuted },
  active: { color: colors.textMuted },
  injured: { color: colors.error },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
