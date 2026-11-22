import { Pressable, Text, View } from 'react-native';

import { ToggleRow } from '@/components';
import { Section } from '@/features/settings/Section';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import type { ThemeMode } from '@/store/types';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

const MODES: readonly ThemeMode[] = ['dark', 'light', 'system'];

/**
 * v8 Profile tab "Appearance": Dark / Light / System and the dyslexia-friendly font. Device
 * settings: persisted, kept on "Delete all data", not exported. The whole app switches at once.
 */
export function AppearanceSection() {
  const styles = useStyles();
  const t = useT();
  const a = t.appearance;
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const dyslexiaFont = useAppStore((s) => s.dyslexiaFont);
  const setDyslexiaFont = useAppStore((s) => s.setDyslexiaFont);
  const names: Record<ThemeMode, string> = {
    dark: a.themeDark,
    light: a.themeLight,
    system: a.themeSystem,
  };

  return (
    <Section title={a.title}>
      <Text style={styles.label}>{a.theme}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={a.theme}>
        {MODES.map((mode) => {
          const active = mode === themeMode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityLabel={a.themeOption(names[mode])}
              accessibilityState={{ checked: active }}
              aria-checked={active}
              onPress={() => setThemeMode(mode)}
              style={[styles.option, active && styles.active]}
              testID={`theme-${mode}`}
            >
              <Text style={[styles.optionLabel, active && styles.activeLabel]} numberOfLines={1}>
                {names[mode]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ToggleRow
        label={a.dyslexiaFont}
        value={dyslexiaFont}
        onChange={setDyslexiaFont}
        testID="dyslexia-font"
      />
      <Text style={styles.hint}>{a.dyslexiaFontHint}</Text>
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
  label: { ...typography.label, color: theme.colors.text },
  row: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  option: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  active: { backgroundColor: theme.colors.primary },
  optionLabel: { ...typography.label, color: theme.colors.text, textAlign: 'center' },
  activeLabel: { color: theme.colors.onPrimary },
  hint: { ...typography.caption, color: theme.colors.textMuted },
}));
