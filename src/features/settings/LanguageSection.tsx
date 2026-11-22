import { Pressable, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import type { Language } from '@/store/types';
import { makeStyles, radius, spacing, touchTarget, typography } from '@/theme';

import { Section } from './Section';

const LANGUAGES: readonly Language[] = ['en', 'de'];

/** English / Deutsch switch. The choice is persisted by the store and kept on "Delete all". */
export function LanguageSection() {
  const styles = useStyles();
  const t = useT();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const names: Record<Language, string> = { en: t.language.english, de: t.language.german };

  return (
    <Section title={t.language.title} hint={t.language.hint}>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={t.language.title}>
        {LANGUAGES.map((lang) => {
          const active = lang === language;
          return (
            <Pressable
              key={lang}
              accessibilityRole="radio"
              accessibilityLabel={t.language.optionLabel(names[lang])}
              accessibilityState={{ checked: active }}
              aria-checked={active}
              onPress={() => setLanguage(lang)}
              style={[styles.option, active && styles.active]}
              testID={`language-${lang}`}
            >
              <Text style={[styles.label, active && styles.activeLabel]}>{names[lang]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

const useStyles = makeStyles((theme) => ({
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
  label: { ...typography.label, color: theme.colors.text, textAlign: 'center' },
  activeLabel: { color: theme.colors.onPrimary },
}));
