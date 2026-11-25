import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ConfirmDialog } from '@/components';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { ErrorText } from './ErrorText';
import { useDeleteAccount } from './useDeleteAccount';

/**
 * v10: Account → Delete account. Blocked teams are listed with a link to their Members screen
 * ("Make someone else manager or delete the team first"); local data is never touched.
 */
export function DeleteAccountSection({ onDeleted }: { onDeleted: () => void }) {
  const styles = useStyles();
  const t = useT();
  const s = t.account.deleteAccount;
  const router = useRouter();
  const flow = useDeleteAccount(onDeleted);
  const nameOf = (name: string | null) => name ?? s.notOnDevice;

  return (
    <Section title={s.title} hint={s.hint} tone="danger">
      <Button
        label={s.button}
        variant="danger"
        onPress={() => void flow.start()}
        disabled={flow.busy}
        testID="delete-account"
      />
      <ErrorText error={flow.error} testID="delete-account-error" />
      {flow.blocked.length > 0 ? (
        <View style={styles.blocked} accessibilityRole="alert" testID="delete-account-blocked">
          <Text style={styles.text}>{s.blocked}</Text>
          {flow.blocked.map((team) => (
            <View key={team.id} style={styles.row}>
              <Text style={styles.team}>{nameOf(team.name)}</Text>
              {team.local ? (
                <Button
                  label={s.members}
                  accessibilityLabel={s.membersLabel(nameOf(team.name))}
                  variant="secondary"
                  compact
                  onPress={() =>
                    router.push({ pathname: '/team/[teamId]/members', params: { teamId: team.id } })
                  }
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <ConfirmDialog
        visible={flow.confirming !== null}
        message={s.confirm((flow.confirming ?? []).map((team) => nameOf(team.name)))}
        confirmLabel={s.button}
        onConfirm={() => void flow.confirm()}
        onCancel={flow.cancel}
      />
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  blocked: { gap: spacing.sm },
  text: { ...typography.body, color: theme.colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  team: { ...typography.subheading, color: theme.colors.text, flexShrink: 1 },
}));
