import { Text, View } from 'react-native';

import { Button, Dialog } from '@/components';
import type { Team, TeamRole } from '@/domain/types';
import { useT } from '@/i18n';
import { heldMatchesNow, useHeldMatches, useMatchesForTeam } from '@/store';
import { makeStyles, spacing, typography } from '@/theme';

import { useSharedTeamDelete } from './useSharedTeamDelete';

export interface SharedTeamDeleteDialogProps {
  team: Team;
  role: TeamRole;
  onClose: () => void;
}

/**
 * v10: Delete on a shared team's row (design §3.11). Managers: Remove from this device / Delete
 * for everyone; players: Remove from this device / Leave team. Mount to show.
 */
export function SharedTeamDeleteDialog({ team, role, onClose }: SharedTeamDeleteDialogProps) {
  const styles = useStyles();
  const t = useT();
  const s = t.sync.teamDelete;
  const { busy, error, removeHere, deleteEverywhere, leave } = useSharedTeamDelete(
    team.id,
    onClose,
  );
  const manager = role === 'manager';
  const title = manager ? s.title(team.name) : s.removeTitle(team.name);
  // v10 audit M15: not for everyone while another device is scoring one of its matches live.
  const matchIds = useMatchesForTeam(team.id).map((m) => m.id);
  const holder = [...useHeldMatches(matchIds).values()][0];
  // While a request runs, the dialog can't be closed (its result removes the team or explains).
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Dialog
      onClose={close}
      title={title}
      testID="shared-team-delete"
      cardProps={{
        role: 'dialog',
        'aria-modal': true,
        accessibilityLabel: title,
        'aria-label': title,
      }}
    >
      <Text style={styles.body}>{manager ? s.managerBody : s.playerBody}</Text>
      {manager && holder ? (
        <Text style={styles.body} testID="shared-team-delete-held">
          {t.sync.readOnly.heldNoDelete(holder.holderName)}
        </Text>
      ) : null}
      {error ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          testID="shared-team-delete-error"
        >
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label={s.removeHere}
          accessibilityLabel={s.removeHereLabel(team.name)}
          variant="secondary"
          disabled={busy}
          onPress={removeHere}
          testID="team-remove-here"
        />
        {manager ? (
          <Button
            label={s.deleteEverywhere}
            accessibilityLabel={s.deleteEverywhereLabel(team.name)}
            variant="danger"
            disabled={busy || holder !== undefined}
            accessibilityHint={holder ? t.sync.readOnly.heldNoDelete(holder.holderName) : undefined}
            onPress={() => {
              if (heldMatchesNow(matchIds).length === 0) void deleteEverywhere();
            }}
            testID="team-delete-everywhere"
          />
        ) : (
          <Button
            label={s.leave}
            accessibilityLabel={s.leaveLabel(team.name)}
            variant="danger"
            disabled={busy}
            onPress={() => void leave()}
            testID="team-leave"
          />
        )}
        <Button
          label={s.cancel}
          accessibilityLabel={s.cancelLabel}
          variant="ghost"
          disabled={busy}
          onPress={close}
          testID="team-delete-cancel"
        />
      </View>
    </Dialog>
  );
}

const useStyles = makeStyles((theme) => ({
  body: { ...typography.body, color: theme.colors.textMuted },
  error: { ...typography.body, color: theme.colors.error },
  // The choices stacked, each as wide as the card (long German labels).
  actions: { gap: spacing.sm },
}));
