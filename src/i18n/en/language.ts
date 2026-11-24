/** Strings for the language setting (v2). The option names stay in their own language. */
export const language = {
  title: 'Language / Sprache',
  hint: 'Choose the language of the app.',
  english: 'English',
  german: 'Deutsch',
  optionLabel: (name: string) => `${name}: app language`,
  display: {
    title: 'Player chips',
    hint: 'On the court and the bench, show the player’s name in the circle and the number below it.',
    namesInsteadOfNumbers: 'Prioritise names',
  },
} as const;
