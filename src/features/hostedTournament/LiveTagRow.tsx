import { Text, View } from 'react-native';

import { useFormStyles } from '@/components';
import { playerRef, tagSide } from '@/domain/hostedTournament';
import {
  HOSTED_POINT_KINDS,
  type HostedPlayer,
  type HostedPlayerLabel,
  type HostedPoint,
  type HostedPointKind,
} from '@/domain/types';
import { TagChip } from '@/features/live/TagChip';
import { useT } from '@/i18n';
import { makeStyles, spacing } from '@/theme';

/** A side of the match as the tag row needs it. */
export interface TagSide {
  name: string;
  players: readonly HostedPlayer[];
  label: HostedPlayerLabel;
}

export interface LiveTagRowProps {
  /** The rally just recorded. */
  point: HostedPoint;
  sides: { a: TagSide; b: TagSide };
  /** Tags the rally (kind null removes the tag). */
  onTag: (kind: HostedPointKind | null, playerId: string | null) => void;
  onClose: () => void;
}

/**
 * v12.2: the optional questions after a rally. First how the point was won (attack, ace, block,
 * the opponent's error). When the side the answer is about has players, then who — every player
 * as a chip (the chips wrap; nothing scrolls sideways). A team without players is asked only the
 * first question. Tapping a chosen chip again takes the answer back.
 */
export function LiveTagRow({ point, sides, onTag, onClose }: LiveTagRowProps) {
  const formStyles = useFormStyles();
  const styles = useStyles();
  const t = useT();
  const s = t.tournament.live.tag;
  const scorer = sides[point.team];
  const chosen = point.kind;
  // Whose player the chosen kind names: the scoring side's, or for an error the other side's.
  const who = chosen === undefined ? null : sides[tagSide(point, chosen)];

  return (
    <View style={styles.wrap} testID="live-tags">
      <Text style={formStyles.hint}>{s.label}</Text>
      <View style={styles.chips}>
        {HOSTED_POINT_KINDS.map((kind) => {
          const selected = kind === chosen;
          return (
            <TagChip
              key={kind}
              label={s.kinds[kind]}
              accessibilityLabel={
                selected ? s.clearKindLabel(s.kinds[kind]) : s.kindLabel(s.kinds[kind], scorer.name)
              }
              selected={selected}
              onPress={() => onTag(selected ? null : kind, null)}
              testID={`live-tag-${kind}`}
            />
          );
        })}
        <TagChip
          label={s.close}
          accessibilityLabel={s.closeLabel}
          onPress={onClose}
          testID="live-tag-close"
        />
      </View>
      {chosen !== undefined && who !== null && who.players.length > 0 ? (
        <>
          <Text style={formStyles.hint} testID="live-tag-who">
            {chosen === 'error' ? s.errorWho(who.name) : s.who(s.kinds[chosen], who.name)}
          </Text>
          <View style={styles.chips}>
            {who.players.map((player) => {
              const ref = playerRef(player, who.label, t.tournament.players.numberText);
              const selected = player.id === point.playerId;
              return (
                <TagChip
                  key={player.id}
                  label={ref.short}
                  accessibilityLabel={s.playerLabel(ref.short, ref.full)}
                  selected={selected}
                  onPress={() => onTag(chosen, selected ? null : player.id)}
                  testID={`live-tag-player-${player.id}`}
                />
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
}));
