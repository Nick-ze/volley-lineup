import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { SyncNotice } from '@/domain/types';
import { useT, type Strings } from '@/i18n';
import { dismissSyncNotice, useSyncNotices } from '@/store';
import { makeStyles, radius, spacing, typography } from '@/theme';

/** Narrowest the notice text gets before Dismiss wraps below it (px). */
const TEXT_MIN_WIDTH = 200;

/**
 * What a notice says (removed, team deleted, demoted, records skipped, scoring taken over, a
 * team that can't be shown yet, records that can't be synced).
 */
export function syncNoticeText(t: Strings, notice: SyncNotice): string {
  const s = t.sync.notices;
  switch (notice.kind) {
    case 'removed':
      return s.removed(notice.teamName);
    case 'deleted':
      return s.deleted(notice.teamName);
    case 'demoted':
      return s.demoted(notice.teamName, notice.undone);
    case 'skipped':
      return s.skipped(notice.teamName, notice.count);
    case 'takenOver':
      return s.takenOver(notice.teamName, notice.holder, notice.undone);
    case 'waiting':
      return s.waiting;
    case 'unsent':
      return s.unsent(notice.teamName, notice.label, notice.count, notice.reason);
  }
}

/**
 * v10: what the last sync wants the user to know (Teams tab, design §7.2), one banner per notice
 * with Dismiss. Notices live in the runtime store only (shown until dismissed or the app closes).
 */
export function SyncNotices() {
  const styles = useStyles();
  const t = useT();
  const notices = useSyncNotices();
  if (notices.length === 0) return null;
  return (
    <View style={styles.list} testID="sync-notices">
      {notices.map((notice, i) => (
        <View key={`${notice.kind}-${notice.teamId}-${i}`} style={styles.banner}>
          <Text style={styles.text} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {syncNoticeText(t, notice)}
          </Text>
          <Button
            label={t.sync.notices.dismiss}
            accessibilityLabel={t.sync.notices.dismissLabel(
              notice.teamName || t.sync.notices.aTeam,
            )}
            variant="ghost"
            compact
            onPress={() => dismissSyncNotice(notice)}
            testID="sync-notice-dismiss"
          />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  list: { gap: spacing.sm },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.highlightText,
    backgroundColor: theme.colors.surface,
  },
  // Dismiss sits beside the text, or below it (right) when the line gets too narrow.
  text: {
    ...typography.body,
    color: theme.colors.text,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: TEXT_MIN_WIDTH,
  },
}));
