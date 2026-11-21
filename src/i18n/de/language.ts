import type { Strings } from '../en';

/** Sprach-Einstellung. Die Namen der Sprachen bleiben in ihrer eigenen Sprache. */
export const language: Strings['language'] = {
  title: 'Language / Sprache',
  hint: 'Wähle die Sprache der App.',
  english: 'English',
  german: 'Deutsch',
  optionLabel: (name: string) => `Sprache: ${name}`,
  display: {
    title: 'Spieler-Chips',
    hint: 'Auf dem Feld und der Bank steht der Name im Kreis und die Nummer darunter.',
    namesInsteadOfNumbers: 'Namen statt Nummern anzeigen',
  },
};
