import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import {
  fillFromTemplate,
  TEMPLATE_SYSTEMS,
  type MissingSlot,
  type TemplateSystem,
} from '@/domain/templates';
import { useT } from '@/i18n';
import { makeStyles, radius, spacing, typography } from '@/theme';

import type { LineupDraft } from './useLineupDraft';

/**
 * "Fill from template": pick 5-1 or 6-2 and fill the starting six from the roster, then say
 * which positions could not be filled. Remount (key by set number) to reset the message.
 */
export function TemplateFill({ editor }: { editor: LineupDraft }) {
  const styles = useStyles();
  const t = useT();
  const { set, players, update } = editor;
  const [open, setOpen] = useState(false);
  // The outcome is kept as data so the message follows a language switch.
  const [filled, setFilled] = useState<{
    system: TemplateSystem;
    missingSlots: MissingSlot[];
  } | null>(null);
  const s = t.lineup.template;
  // A played set's starters must not change under its event log.
  const locked = set.events.length > 0;

  const apply = (system: TemplateSystem) => {
    const result = fillFromTemplate(system, players, set.setNumber, set);
    update(result.set);
    setOpen(false);
    setFilled({ system, missingSlots: result.missingSlots });
  };

  const warn = Boolean(filled && filled.missingSlots.length > 0);
  const message = filled
    ? warn
      ? s.missing(
          filled.system,
          filled.missingSlots.map((m) => s.missingItem(m.position, t.positions[m.role])).join(', '),
        )
      : s.filled(filled.system)
    : null;

  return (
    <View style={styles.wrap}>
      {open && !locked ? (
        <View style={styles.box}>
          <Text style={styles.hint}>{s.choose}</Text>
          <View style={styles.row}>
            {TEMPLATE_SYSTEMS.map((system) => (
              <Button
                key={system}
                label={system}
                accessibilityLabel={s.systemLabel(system)}
                compact
                onPress={() => apply(system)}
                testID={`template-${system}`}
                style={styles.grow}
              />
            ))}
            <Button
              label={s.cancel}
              accessibilityLabel={s.cancelLabel}
              variant="ghost"
              compact
              onPress={() => setOpen(false)}
              testID="template-cancel"
            />
          </View>
        </View>
      ) : (
        <Button
          label={s.open}
          accessibilityHint={locked ? s.lockedHint : s.openHint}
          variant="secondary"
          compact
          disabled={locked}
          onPress={() => {
            setFilled(null);
            setOpen(true);
          }}
          testID="template-open"
        />
      )}
      {locked ? (
        <Text style={styles.hint} testID="template-locked">
          {s.lockedHint}
        </Text>
      ) : null}
      {message ? (
        <Text
          style={[styles.message, warn && styles.warn]}
          accessibilityLiveRegion="polite"
          testID="template-message"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  wrap: { gap: spacing.sm },
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: radius.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  hint: { ...typography.caption, color: theme.colors.textMuted },
  message: { ...typography.body, color: theme.colors.text },
  warn: { color: theme.colors.highlightText },
}));
