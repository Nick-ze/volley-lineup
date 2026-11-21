import { StyleSheet, Text, View } from 'react-native';

import { Button, Photo, PositionBadge } from '@/components';
import type { Player } from '@/domain/types';
import { NumberAvatar } from '@/features/photos/NumberAvatar';
import { useT } from '@/i18n';
import { usePhotoUri } from '@/store';
import { colors, radius, spacing, typography } from '@/theme';

import { ListRow } from './ListRow';

export interface PlayerRowProps {
  player: Player;
  onPress: () => void;
  onToggleActive: () => void;
}

/** One roster line: photo (with a small number) or number, name, position badges and the active / injured toggle. */
export function PlayerRow({ player, onPress, onToggleActive }: PlayerRowProps) {
  const t = useT();
  const name = `${player.firstName} ${player.lastName}`;
  const s = t.roster.roster;
  const positions = player.positions.map((p) => t.positions[p]).join(', ');
  const hasPhoto = usePhotoUri(player.photoId) !== null;
  return (
    <ListRow
      title={name}
      onPress={onPress}
      accessibilityLabel={s.rowLabel(player.number, name, positions, player.active)}
      testID={`player-${player.number}`}
      leading={
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Photo
            photoId={player.photoId}
            dimmed={!player.active}
            fallback={<NumberAvatar number={player.number} inactive={!player.active} />}
          />
          {hasPhoto ? (
            <Text style={styles.numberTag} testID={`player-${player.number}-photo-number`}>
              {player.number}
            </Text>
          ) : null}
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
  // The number stays visible on a photo: a small badge at the bottom right.
  numberTag: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    ...typography.caption,
    fontWeight: typography.jersey.fontWeight,
    color: colors.onPrimary,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
