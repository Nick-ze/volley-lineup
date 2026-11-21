import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components';
import { fillFromTemplate, TEMPLATE_SYSTEMS, type TemplateSystem } from '@/domain/templates';
import { t } from '@/i18n/en';
import { colors, radius, spacing, typography } from '@/theme';

import type { LineupEditor } from './useLineupEditor';

/**
 * "Fill from template": pick 5-1 or 6-2 and fill the starting six from the roster, then say
 * which positions could not be filled. Remount (key by set number) to reset the message.
 */
export function TemplateFill({ editor }: { editor: LineupEditor }) {
  const { set, players, update } = editor;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);
  const s = t.lineup.template;

  const apply = (system: TemplateSystem) => {
    const result = fillFromTemplate(system, players, set.setNumber, set);
    update(result.set);
    setOpen(false);
    const list = result.missingSlots
      .map((m) => s.missingItem(m.position, t.positions[m.role]))
      .join(', ');
    setMessage(
      result.missingSlots.length === 0
        ? { text: s.filled(system), warn: false }
        : { text: s.missing(system, list), warn: true },
    );
  };

  return (
    <View style={styles.wrap}>
      {open ? (
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
          accessibilityHint={s.openHint}
          variant="secondary"
          compact
          onPress={() => {
            setMessage(null);
            setOpen(true);
          }}
          testID="template-open"
        />
      )}
      {message ? (
        <Text
          style={[styles.message, message.warn && styles.warn]}
          accessibilityLiveRegion="polite"
          testID="template-message"
        >
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  box: {
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted },
  message: { ...typography.body, color: colors.text },
  warn: { color: colors.highlight },
});
