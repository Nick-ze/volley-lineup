import { Text, View } from 'react-native';

import { PlayerChip } from '@/components';
import type { Player } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import { CHIP_SIZE, COMPACT_CHIP_SIZE } from './layout';

export interface SetInfoProps {
  libero: Player | undefined;
  /** The set's libero id, to tell "no libero" from "unknown libero". */
  liberoId: string | null;
  weServeFirst: boolean;
  compact?: boolean;
}

/** Libero + "we serve / receive first" — shown next to (wide) or under (phone) the court. */
export function SetInfo({ libero, liberoId, weServeFirst, compact = false }: SetInfoProps) {
  const styles = useStyles();
  const t = useT();
  const serveText = weServeFirst ? t.rotation.weServeFirst : t.rotation.weReceiveFirst;
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={styles.libero}>
        <Text style={styles.caption}>{t.rotation.libero}</Text>
        {libero ? (
          <PlayerChip
            player={libero}
            size={compact ? COMPACT_CHIP_SIZE : CHIP_SIZE}
            testID="libero-chip"
          />
        ) : (
          <Text style={styles.muted}>
            {liberoId ? t.rotation.unknownPlayer : t.rotation.noLibero}
          </Text>
        )}
      </View>
      <View
        style={[styles.serve, weServeFirst && styles.serveUs]}
        accessible
        accessibilityLabel={serveText}
        testID="serve-info"
      >
        <Text style={[styles.serveText, weServeFirst && styles.serveTextUs]}>{serveText}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  compact: {
    padding: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  libero: { alignItems: 'center', gap: spacing.xs },
  caption: { ...typography.label, color: theme.colors.textMuted },
  muted: { ...typography.body, color: theme.colors.textMuted },
  serve: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  serveUs: { backgroundColor: theme.colors.highlight, borderColor: theme.colors.highlight },
  serveText: { ...typography.label, color: theme.colors.text },
  serveTextUs: { color: theme.colors.onHighlight },
}));
