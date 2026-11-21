import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { LastRally } from '@/domain/lastRally';
import type { Player, PointKind } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { playerDescription, playerRef } from './format';
import { TagChip } from './TagChip';

export interface TagPlayerPickerProps {
  /** The chosen kind (one that names a player). */
  kind: PointKind;
  rally: LastRally;
  playersById: Map<string, Player>;
  onTag: (kind: PointKind | null, playerId: string | null) => void;
  /** The close chip, shared with the kinds row. */
  close: ReactNode;
}

/**
 * The chosen kind (tap to clear the tag) and our players on court during the rally, by jersey
 * number. The server is outlined for an ace; tapping the chosen player again removes them.
 */
export function TagPlayerPicker({ kind, rally, playersById, onTag, close }: TagPlayerPickerProps) {
  const t = useT();
  const name = t.tags.kindNames[kind];
  const onCourt = rally.playerIds
    .map((id) => playersById.get(id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => a.number - b.number);
  const chosen = rally.event.playerId;

  return (
    <View style={styles.row} accessibilityLabel={t.tags.playersLabel(name)} testID="point-tag-row">
      <TagChip
        label={t.tags.kinds[kind]}
        accessibilityLabel={t.tags.clearKind(name)}
        selected
        onPress={() => onTag(null, null)}
        testID={`tag-${kind}`}
      />
      {onCourt.map((p) => {
        const selected = p.id === chosen;
        const desc = playerDescription(t, p);
        return (
          <TagChip
            key={p.id}
            label={playerRef(t, playersById, p.id)}
            accessibilityLabel={
              selected ? t.tags.clearPlayer(desc) : t.tags.choosePlayer(desc, name)
            }
            selected={selected}
            highlighted={kind === 'ace' && p.id === rally.serverId}
            onPress={() => onTag(kind, selected ? null : p.id)}
            testID={`tag-player-${p.id}`}
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
