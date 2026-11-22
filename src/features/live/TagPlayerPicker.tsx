import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { NoTabSwipe } from '@/components';
import { plausiblePlayerIds, type LastRally } from '@/domain/lastRally';
import { kindTakesErrorType } from '@/domain/pointTags';
import type { ErrorType, Player, PointKind } from '@/domain/types';
import { useT } from '@/i18n';
import { spacing } from '@/theme';

import { ErrorTypeChips } from './ErrorTypeChips';
import { playerDescription, playerRef } from './format';
import { TagChip } from './TagChip';

export interface TagPlayerPickerProps {
  /** The chosen kind (one that names a player). */
  kind: PointKind;
  rally: LastRally;
  playersById: Map<string, Player>;
  onTag: (kind: PointKind | null, playerId: string | null) => void;
  /** v6: saves the error type of "our error" (null clears it). */
  onErrorType: (type: ErrorType | null) => void;
  /** The close chip, shared with the kinds row. */
  close: ReactNode;
}

/**
 * The chosen kind (tap to clear the tag) and the players of ours who could have done it during
 * the rally (`plausiblePlayerIds`), by jersey number. The server is outlined for an ace or a
 * serve error; tapping the chosen player again removes them. For "our error" the optional error
 * types come first (`ErrorTypeChips`) and narrow the players.
 *
 * v6 QA: one line that scrolls sideways (✕ stays visible on the right), so the row is never
 * taller than the kinds row and the live court + Substitution still fit at 390×844 (#75, #126).
 */
export function TagPlayerPicker({
  kind,
  rally,
  playersById,
  onTag,
  onErrorType,
  close,
}: TagPlayerPickerProps) {
  const t = useT();
  const name = t.tags.kindNames[kind];
  const errorType = rally.event.errorType ?? null;
  // Only who could plausibly have done it (rules check #35: block = front row, ace = server, …).
  const onCourt = plausiblePlayerIds(rally, kind, errorType)
    .map((id) => playersById.get(id))
    .filter((p): p is Player => p !== undefined)
    .sort((a, b) => a.number - b.number);
  const chosen = rally.event.playerId;
  const served = kind === 'ace' || errorType === 'serve';

  const kindChip = (
    <TagChip
      label={t.tags.kinds[kind]}
      accessibilityLabel={t.tags.clearKind(name)}
      selected
      onPress={() => onTag(null, null)}
      testID={`tag-${kind}`}
    />
  );
  return (
    // v8: a drag anywhere on the row (chips, kind chip, ✕) scrolls the chips, never the
    // Live ↔ Performance swipe, so the open tag row is never lost (v8 QA).
    <NoTabSwipe testID="point-tag-row-no-swipe">
      <View
        style={styles.row}
        accessibilityLabel={t.tags.playersLabel(name)}
        testID="point-tag-row"
      >
        <ScrollView
          horizontal
          style={styles.scroll}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {kindTakesErrorType(kind) ? (
            <ErrorTypeChips rally={rally} kindChip={kindChip} onErrorType={onErrorType} />
          ) : (
            kindChip
          )}
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
                highlighted={served && p.id === rally.serverId}
                onPress={() => onTag(kind, selected ? null : p.id)}
                testID={`tag-player-${p.id}`}
              />
            );
          })}
        </ScrollView>
        {close}
      </View>
    </NoTabSwipe>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scroll: { flex: 1 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
