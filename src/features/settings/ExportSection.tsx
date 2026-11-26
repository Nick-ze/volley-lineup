import { Text, View } from 'react-native';

import { Button } from '@/components';
import { IncludeDescriptionsToggle } from '@/features/descriptions/IncludeDescriptionsToggle';
import { useDescriptionLock } from '@/features/descriptions/descriptionLock';
import { useT } from '@/i18n';
import { useAppStore, useTeamsForProfile } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

import { Section } from './Section';
import { StatusMessage } from './StatusMessage';
import { useExport } from './useExport';

/**
 * Export everything, or one team of the current profile; optionally with descriptions.
 * v10 (audit H6): warns before the export when a team has two players with one jersey number.
 */
export function ExportSection() {
  const styles = useStyles();
  const t = useT();
  const { exportData, status, busy, warning } = useExport();
  const currentProfileId = useAppStore((s) => s.currentProfileId);
  const teams = useTeamsForProfile(currentProfileId);
  // Only true while unlocked (locking clears it): descriptions are exported only when chosen.
  const includeDescriptions = useDescriptionLock((x) => x.unlocked && x.includeInExport);
  const options = { includeDescriptions };

  return (
    <Section title={t.transfer.export.title} hint={t.transfer.export.hint}>
      {warning ? (
        <Text
          style={styles.warning}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="export-duplicate-numbers"
        >
          {warning}
        </Text>
      ) : null}
      <IncludeDescriptionsToggle />
      <Button
        label={t.transfer.export.all}
        onPress={() => exportData(undefined, options)}
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
                onPress={() => exportData(team, options)}
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

const useStyles = makeStyles((theme) => ({
  teams: { gap: spacing.sm },
  heading: { ...typography.label, color: theme.colors.textMuted },
  muted: { ...typography.body, color: theme.colors.textMuted },
  // Yellow = warning (as in the lineup's validation panel); the export itself stays possible.
  warning: { ...typography.body, color: theme.colors.highlightText },
}));
