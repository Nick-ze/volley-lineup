import { Pressable, Text, View } from 'react-native';

import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { fullName } from '@/domain/playerNames';
import { useAppStore, usePhotoUri, useShortName } from '@/store';
import { makeStyles, radius, spacing, touchTarget, typography, useTheme } from '@/theme';

import { PlayerChipFace } from './PlayerChipFace';

export interface PlayerChipProps {
  player: Player;
  /** Diameter of the round chip. Never below the 44 px touch target. */
  size?: number;
  selected?: boolean;
  /** e.g. the server in the rotation viewer (yellow ring). */
  highlighted?: boolean;
  /** Visually "lifted" (drag in progress). */
  lifted?: boolean;
  showName?: boolean;
  /**
   * v6, bench and pickers: show the player's photo in the circle, with "#7 Name" below
   * (needs `showName`). Court chips keep the number / name (`chipLabel` setting).
   */
  showPhoto?: boolean;
  onPress?: () => void;
  /** Shown and announced as disabled (presses ignored). */
  disabled?: boolean;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

export function PlayerChip({
  player,
  size = 64,
  selected = false,
  highlighted = false,
  lifted = false,
  showName = true,
  showPhoto = false,
  onPress,
  disabled = false,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: PlayerChipProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const t = useT();
  // Settings → "Prioritise names": the circle shows the name, the pill the number.
  const namesFirst = useAppStore((s) => s.chipLabel) === 'name';
  const d = Math.max(size, touchTarget);
  // v8: first name first ("Anna"; "Anna M." when a teammate is also called Anna).
  const shortName = useShortName(player);
  const primary = player.positions[0];
  const label =
    accessibilityLabel ??
    t.player.chipLabel(player.number, fullName(player), primary ? t.positions[primary] : '');
  const storedPhoto = usePhotoUri(player.photoId);
  const photoUri = showPhoto && showName ? storedPhoto : null;
  // v8.4: chips that show the number / name (the court) show the picture faded behind it.
  const backdropUri = photoUri === null ? storedPhoto : null;
  // Text-strength tokens: same as primary / highlight in dark mode, ≥ 3:1 outlines in light mode.
  const ringColor = selected
    ? colors.primaryText
    : highlighted
      ? colors.highlightText
      : colors.border;

  const content = (
    <View style={styles.wrapper}>
      <PlayerChipFace
        player={player}
        name={shortName}
        diameter={d}
        photoUri={photoUri}
        backdropUri={backdropUri}
        namesFirst={namesFirst}
        ringColor={ringColor}
        thickRing={selected || highlighted}
        lifted={lifted}
        testID={testID}
      />
      {showName ? (
        <Text style={styles.name} numberOfLines={1}>
          {photoUri !== null
            ? t.photos.chipCaption(player.number, shortName)
            : namesFirst
              ? t.player.numberTag(player.number)
              : shortName}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress && !onLongPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      testID={testID}
      hitSlop={spacing.xs}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  wrapper: { alignItems: 'center', gap: spacing.xxs },
  // Dark pill behind the name so it stays AA-readable on the orange court (white on orange ≈ 2.9:1).
  name: {
    ...typography.caption,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing.xs,
    maxWidth: 88,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
}));
