import { Pressable, Text, View } from 'react-native';

import { useTrackStyles } from '@/components';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';
import type { Language } from '@/store/types';

import { Section } from './Section';

const LANGUAGES: readonly Language[] = ['en', 'de'];

/** English / Deutsch switch. The choice is persisted by the store and kept on "Delete all". */
export function LanguageSection() {
  const track = useTrackStyles();
  const t = useT();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const names: Record<Language, string> = { en: t.language.english, de: t.language.german };

  return (
    <Section title={t.language.title} hint={t.language.hint}>
      <View
        style={[track.track, track.trackOnPanel]}
        accessibilityRole="radiogroup"
        accessibilityLabel={t.language.title}
      >
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
              style={[track.segment, active && track.choice]}
              testID={`language-${lang}`}
            >
              <Text style={[track.text, active && track.choiceText]}>{names[lang]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}
