/** v8: Profile tab "Appearance" settings (theme, dyslexia font) and date field hints. */
export const appearance = {
  title: 'Appearance',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeSystem: 'System',
  /** Starts with the visible option text (label in name). */
  themeOption: (name: string) => `${name} theme`,
  dyslexiaFont: 'Dyslexia-friendly font',
  dyslexiaFontHint: 'All text uses OpenDyslexic.',
  dateHint: 'dd.mm.yy',
};
