import type { Strings } from '../en';

/** v8: Profil-Tab „Darstellung“ (Design, Legasthenie-Schrift) und Hinweise für Datumsfelder. */
export const appearance: Strings['appearance'] = {
  title: 'Darstellung',
  theme: 'Design',
  themeDark: 'Dunkel',
  themeLight: 'Hell',
  themeSystem: 'System',
  themeOption: (name: string) => `${name} (Design)`,
  dyslexiaFont: 'Legasthenie-freundliche Schrift',
  dyslexiaFontHint: 'Alle Texte verwenden OpenDyslexic.',
  dateHint: 'tt.mm.jj',
};
