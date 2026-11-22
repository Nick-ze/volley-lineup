import { Text, View } from 'react-native';

import { teamAvatarColor, teamInitial } from '@/domain/teamAvatar';
import type { Team } from '@/domain/types';
import {
  inlineFontSize,
  makeStyles,
  onProfileColor,
  profileColors,
  radius,
  touchTarget,
  useTheme,
} from '@/theme';

import { Photo } from './Photo';

export interface TeamAvatarProps {
  team: Pick<Team, 'id' | 'name' | 'photoId'>;
  /** Diameter in px (default 44). */
  size?: number;
}

/**
 * v8: a team's picture, or its initial in a circle of a colour picked by the team's id.
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
          borderRadius: size / 2,
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
  return <Photo photoId={team.photoId} size={size} fallback={fallback} />;
}

const useStyles = makeStyles(() => ({
  circle: { borderRadius: radius.round, alignItems: 'center', justifyContent: 'center' },
  // All profile colours are light / bright enough for near-black text (AA).
  letter: { fontWeight: '700', color: onProfileColor, lineHeight: undefined },
}));
