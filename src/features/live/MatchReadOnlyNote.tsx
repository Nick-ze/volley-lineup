import { useState } from 'react';
import { Text, View } from 'react-native';

import { ReadOnlyNote } from '@/components';
import type { SyncErrorCode } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { holdMatch } from '@/lib/sync';
import { useMatch, useMatchAccess } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

/** The short message for a failed "Take over". */
function takeOverError(t: Strings, error: SyncErrorCode | 'denied'): string {
  const s = t.sync.match.takeOverFailed;
  if (error === 'offline') return s.offline;
  if (error === 'forbidden') return s.forbidden;
  return s.other;
}

/**
 * v10: why this match can't be changed here (a view-only member, or another device scoring it
 * live), with "Take over" for a held match. A held match is only ever shown to managers (a
 * viewer's reason is "view only"), so Take over is always offered with 'held'. Renders nothing
 * when this device may edit the match (every local team).
 * `onTakenOver` runs after a granted Take over: off the live screen it opens live, whose
 * `useMatchHold` then refreshes and releases the hold (taking over only makes sense to score).
 */
export function MatchReadOnlyNote({
  matchId,
  onTakenOver,
}: {
  matchId: string | undefined;
  onTakenOver?: () => void;
}) {
  const t = useT();
  const styles = useStyles();
  const access = useMatchAccess(matchId);
  const teamId = useMatch(matchId)?.teamId;
  const [error, setError] = useState<SyncErrorCode | 'denied' | null>(null);
  if (access.canEdit) return null;

  const takeOver = async () => {
    if (!teamId || !matchId) return;
    setError(null);
    const result = await holdMatch(teamId, matchId, true);
    if (!result.ok) setError(result.error);
    else if (!result.value.granted) setError('denied');
    else onTakenOver?.();
  };

  return (
    <View style={styles.wrap}>
      <ReadOnlyNote
        block={access.block}
        holder={access.holder}
        onTakeOver={access.block === 'held' ? () => void takeOver() : undefined}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite" testID="take-over-error">
          {takeOverError(t, error)}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  error: { ...typography.body, color: theme.colors.error },
}));
