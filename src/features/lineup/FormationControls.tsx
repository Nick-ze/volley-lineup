import { Text, View } from 'react-native';

import { changeFormation } from '@/domain/formationChange';
import { FORMATION_ORDERS, FORMATION_PATTERNS, FORMATION_SYSTEMS } from '@/domain/roles';
import type { FormationOrder, FormationSystem } from '@/domain/types';
import { useT } from '@/i18n';
import { makeStyles, spacing, typography } from '@/theme';

import { Segmented } from './Segmented';
import type { LineupDraft } from './useLineupDraft';

/**
 * The formation of the lineup (v6): system 5-1 / 6-2 and the order around the court from the
 * setter (followed by an outside or by a middle), in one compact row, with the resulting role
 * order below. A change that puts a starter on an unlisted role asks first; a libero who
 * replaced the middles follows them (`changeFormation`). The setter's spot
 * moves with "Rotate". Disabled in played sets.
 */
export function FormationControls({ editor }: { editor: LineupDraft }) {
  const styles = useStyles();
  const t = useT();
  const s = t.lineup.formation;
  const { set, players, locked, propose } = editor;
  const { system, order } = set.formation;
  const pattern = (sys: FormationSystem, ord: FormationOrder) =>
    FORMATION_PATTERNS[sys][ord].join(' · ');
  const hint = locked ? t.live.lineupLocked : undefined;

  return (
    <View style={styles.wrap} testID="formation-controls">
      <View style={styles.row}>
        <Segmented
          groupLabel={s.systemGroupLabel}
          value={system}
          onChange={(v) => propose(changeFormation(set, { system: v }, players), 'formation')}
          disabled={locked}
          hint={hint}
          style={styles.system}
          options={FORMATION_SYSTEMS.map((v) => ({
            value: v,
            text: v,
            label: s.systemLabel(v, s.systems[v]),
            testID: `formation-system-${v}`,
          }))}
        />
        <Segmented
          groupLabel={s.orderGroupLabel}
          value={order}
          onChange={(v) => propose(changeFormation(set, { order: v }, players), 'formation')}
          disabled={locked}
          hint={hint}
          style={styles.order}
          options={FORMATION_ORDERS.map((v) => ({
            value: v,
            text: s.orders[v],
            label: s.orderLabel(s.orders[v], pattern(system, v)),
            testID: `formation-order-${v}`,
          }))}
        />
      </View>
      <Text style={styles.pattern} testID="formation-pattern">
        {s.pattern(pattern(system, order))}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  system: { flex: 2 },
  order: { flex: 5 },
  pattern: { ...typography.caption, color: theme.colors.textMuted },
}));
