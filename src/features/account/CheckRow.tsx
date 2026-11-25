import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

/** Side of the drawn check box. */
const BOX_SIZE = 22;

export interface CheckRowProps {
  label: string;
  /** A second line (e.g. the role); spoken after the label. */
  detail?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testID?: string;
}

/** v10: a team in the Cloud teams pickers: a check box with the team's name (≥ 44 px row). */
export function CheckRow({ label, detail, checked, onToggle, disabled, testID }: CheckRowProps) {
  const styles = useStyles();
  const t = useT();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={detail ? `${label}: ${detail}` : label}
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      aria-checked={checked}
      aria-disabled={Boolean(disabled)}
      disabled={disabled}
      onPress={onToggle}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.off]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.tick}>{t.account.cloudTeams.checkMark}</Text> : null}
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.8 },
  off: { opacity: 0.4 },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tick: { ...typography.label, color: theme.colors.onPrimary },
  text: { flex: 1 },
  label: { ...typography.body, color: theme.colors.text },
  detail: { ...typography.caption, color: theme.colors.textMuted },
}));
