import { StyleSheet, View } from 'react-native';

import { plausibleKinds, type LastRally } from '@/domain/lastRally';
import { kindTakesPlayer } from '@/domain/pointTags';
import type { ErrorType, Player, PointKind } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { TagChip } from './TagChip';
import { TagPlayerPicker } from './TagPlayerPicker';

export interface PointTagRowProps {
  rally: LastRally;
  playersById: Map<string, Player>;
  /** Tags the last rally (kind null clears the tag). */
  onTag: (kind: PointKind | null, playerId: string | null) => void;
  /** v6: sets the error type of "our error" (null clears it). */
  onErrorType: (type: ErrorType | null) => void;
  onClose: () => void;
}

/**
 * Optional details of the rally just recorded: the kinds of the winning side; once a kind that
 * names a player is chosen, the players on court instead. Tapping a chosen chip again clears it.
 */
export function PointTagRow({ rally, playersById, onTag, onErrorType, onClose }: PointTagRowProps) {
  const t = useT();
  const { event } = rally;
  const chosen = event.kind;
  const close = (
    <TagChip
      label={t.tags.close}
      accessibilityLabel={chosen ? t.tags.doneLabel : t.tags.skipLabel}
      onPress={onClose}
      testID="tag-close"
    />
  );

  if (chosen !== undefined && kindTakesPlayer(chosen)) {
    return (
      <TagPlayerPicker
        kind={chosen}
        rally={rally}
        playersById={playersById}
        onTag={onTag}
        onErrorType={onErrorType}
        close={close}
      />
    );
  }

  const choose = (kind: PointKind) => {
    if (kind === chosen) onTag(null, null);
    // An ace is served: suggest our server of that rally.
    else onTag(kind, kind === 'ace' ? rally.serverId : null);
  };
  return (
    <View
      style={styles.row}
      accessibilityLabel={t.tags.rowLabel(event.winner === 'us')}
      testID="point-tag-row"
    >
      {plausibleKinds(rally).map((kind) => {
        const name = t.tags.kindNames[kind];
        return (
          <TagChip
            key={kind}
            label={t.tags.kinds[kind]}
            accessibilityLabel={kind === chosen ? t.tags.clearKind(name) : t.tags.chooseKind(name)}
            selected={kind === chosen}
            onPress={() => choose(kind)}
            testID={`tag-${kind}`}
          />
        );
      })}
      {close}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
