/** Strings for the language setting (v2). The option names stay in their own language. */
export const language = {
  title: 'Language / Sprache',
  hint: 'Choose the language of the app.',
  english: 'English',
  german: 'Deutsch',
  optionLabel: (name: string) => `Language: ${name}`,
} as const;
