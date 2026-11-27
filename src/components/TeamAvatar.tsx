import { Text, View } from 'react-native';

import { teamAvatarColor, teamInitial } from '@/domain/teamAvatar';
import type { Team } from '@/domain/types';
import {
  inlineFontSize,
  makeStyles,
  onProfileColor,
  profileColors,
  touchTarget,
  useTheme,
} from '@/theme';

import { Photo } from './Photo';

export interface TeamAvatarProps {
  team: Pick<Team, 'id' | 'name' | 'photoId'>;
  /** Width and height in px (default 44). */
  size?: number;
}

/** v11: teams are rounded squares (players and profiles are circles). */
export const teamAvatarRadius = (size: number) => Math.round(size * 0.27);

/**
 * v8: a team's picture, or its initial on a colour picked by the team's id (v11: a rounded
 * square).
 * Decorative: the surrounding element carries the team's name.
 */
export function TeamAvatar({ team, size = touchTarget }: TeamAvatarProps) {
  const styles = useStyles();
  const { fonts } = useTheme();
  const fallback = (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: teamAvatarRadius(size),
          backgroundColor: teamAvatarColor(team.id, profileColors),
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="team-initial"
    >
      <Text style={[styles.letter, inlineFontSize(Math.round(size * 0.45), fonts)]}>
        {teamInitial(team.name)}
      </Text>
    </View>
  );
  return (
    <Photo
      photoId={team.photoId}
      size={size}
      fallback={fallback}
      shape="square"
      cornerRadius={teamAvatarRadius(size)}
    />
  );
}

const useStyles = makeStyles(() => ({
  circle: { alignItems: 'center', justifyContent: 'center' },
  // All profile colours are light / bright enough for near-black text (AA).
  letter: { fontWeight: '700', color: onProfileColor, lineHeight: undefined },
}));
