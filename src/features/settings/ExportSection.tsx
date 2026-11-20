import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { t } from '@/i18n/en';
import { useAppStore, useTeamsForProfile } from '@/store';
import { colors, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage } from './StatusMessage';
import { useExport } from './useExport';

/** Export everything, or one team of the current profile. */
export function ExportSection() {
  const { exportData, status, busy } = useExport();
  const currentProfileId = useAppStore((s) => s.currentProfileId);
  const teams = useTeamsForProfile(currentProfileId);

  return (
    <Section title={t.transfer.export.title} hint={t.transfer.export.hint}>
      <Button
        label={t.transfer.export.all}
        onPress={() => exportData()}
        disabled={busy}
        testID="export-all"
      />
      {currentProfileId ? (
        <View style={styles.teams}>
          <Text style={styles.heading}>{t.transfer.export.teamsHeading}</Text>
          {teams.length === 0 ? (
            <Text style={styles.muted}>{t.transfer.export.noTeams}</Text>
          ) : (
            teams.map((team) => (
              <Button
                key={team.id}
                label={t.transfer.export.team(team.name)}
                accessibilityLabel={t.transfer.export.teamLabel(team.name)}
                variant="secondary"
                onPress={() => exportData(team)}
                disabled={busy}
              />
            ))
          )}
        </View>
      ) : null}
      <StatusMessage status={status} testID="export-status" />
    </Section>
  );
}

const styles = StyleSheet.create({
  teams: { gap: spacing.sm },
  heading: { ...typography.label, color: colors.textMuted },
  muted: { ...typography.body, color: colors.textMuted },
});
