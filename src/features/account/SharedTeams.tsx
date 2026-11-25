import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { ListRow, useListStyles } from '@/components';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

/** v10: Account → the teams shared on this device, with this account's role in each. */
export function SharedTeams() {
  const styles = useListStyles();
  const t = useT();
  const router = useRouter();
  const allTeams = useAppStore((s) => s.teams);
  const linked = useAppStore((s) => s.sync.teams);
  const teams = useMemo(
    () =>
      allTeams.flatMap((team) => {
        const meta = linked[team.id];
        return meta ? [{ id: team.id, name: team.name, role: meta.role }] : [];
      }),
    [allTeams, linked],
  );
  return (
    <Section title={t.account.screen.sharedTeams}>
      {teams.length === 0 ? (
        <Text style={styles.empty}>{t.account.screen.noSharedTeams}</Text>
      ) : (
        <View style={styles.list}>
          {teams.map((team) => {
            const role = t.account.screen.roles[team.role];
            return (
              <ListRow
                key={team.id}
                title={team.name}
                subtitle={role}
                onPress={() =>
                  router.push({ pathname: '/team/[teamId]', params: { teamId: team.id } })
                }
                accessibilityLabel={t.account.screen.openTeamLabel(team.name, role)}
                testID={`shared-team-${team.id}`}
              />
            );
          })}
        </View>
      )}
    </Section>
  );
}
