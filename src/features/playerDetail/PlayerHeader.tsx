import { Text, View } from 'react-native';

import { fullName } from '@/domain/playerNames';
import { Button, Photo, PositionBadge } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

/** Diameter of the header picture / number circle. */
const HEADER_PHOTO_SIZE = 72;

/** Photo (or jersey number), name, number, positions, status and the Edit button. */
export function PlayerHeader({ player, onEdit }: { player: Player; onEdit: () => void }) {
  const styles = useStyles();
  const t = useT();
  const name = fullName(player);
  const status = player.active ? t.roster.roster.active : t.roster.roster.inactive;
  const positions = player.positions.map((p) => t.positions[p]).join(t.playerDetail.listSeparator);
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
            {t.playerDetail.number(player.number)}
            {t.playerDetail.separator}
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

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  number: {
    width: HEADER_PHOTO_SIZE,
    height: HEADER_PHOTO_SIZE,
    borderRadius: radius.round,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { ...typography.jersey, color: theme.colors.onPrimary },
  text: { flex: 1, gap: spacing.xs },
  name: { ...typography.subheading, color: theme.colors.text },
  meta: { ...typography.body, color: theme.colors.textMuted },
  active: { color: theme.colors.textMuted },
  injured: { color: theme.colors.error },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
}));
