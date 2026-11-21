import { useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { presetFromSet, presetToDraft, type PresetLineup } from '@/domain/presets';
import type { SetLineup } from '@/domain/types';
import { LineupBuilder } from '@/features/lineup/LineupBuilder';
import { useLineupDraft } from '@/features/lineup/useLineupDraft';
import { usePlayersForTeam } from '@/store';
import { colors, maxContentWidth, spacing, typography } from '@/theme';

export interface PresetLineupEditorProps {
  teamId: string;
  lineup: PresetLineup;
  onSave: (lineup: PresetLineup) => void;
  /** Explanation shown above the court. */
  hint: string;
  /** Extra header content (e.g. the Rename button). */
  header?: ReactNode;
}

/**
 * The lineup builder (court, libero, bench, templates, checks) for a team preset or the team's
 * starters. No serve choice, no "copy previous set" and never locked: presets are not played.
 */
export function PresetLineupEditor({
  teamId,
  lineup,
  onSave,
  hint,
  header,
}: PresetLineupEditorProps) {
  const players = usePlayersForTeam(teamId);
  const set = useMemo(() => presetToDraft(lineup), [lineup]);
  const save = useCallback((next: SetLineup) => onSave(presetFromSet(next)), [onSave]);
  const draft = useLineupDraft({ set, players, save });

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.inner}>
          {header}
          <Text style={styles.hint}>{hint}</Text>
          <LineupBuilder editor={draft} variant="preset" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  inner: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  hint: { ...typography.body, color: colors.textMuted },
});
