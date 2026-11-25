import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { ReadOnlyNote } from '@/components';
import type { SyncErrorCode } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { holdMatch, releaseMatch } from '@/lib/sync';
import { useMatch, useMatchAccess } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

import { isHeldByLiveScreen } from './useMatchHold';

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
 * A grant that arrives after the note has closed opens nothing and is released again.
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
  // A failed Take over belongs to the block it was tried for: drop it when the reason changes.
  const [errorBlock, setErrorBlock] = useState(access.block);
  if (errorBlock !== access.block) {
    setErrorBlock(access.block);
    setError(null);
  }
  // One Take over at a time (a double tap must not open live twice); the ref also stops a
  // second tap that lands before the disabled button has rendered.
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  if (access.canEdit) return null;

  const takeOver = async () => {
    if (!teamId || !matchId || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const result = await holdMatch(teamId, matchId, true);
    pending.current = false;
    if (!mounted.current) {
      // The user left before the grant: don't open live; give the hold back unless a live
      // screen of the match (which owns the hold) is open, e.g. the grant itself hid this note.
      if (result.ok && result.value.granted && !isHeldByLiveScreen(teamId, matchId))
        void releaseMatch(teamId, matchId);
      return;
    }
    setBusy(false);
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
        takeOverBusy={busy}
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
