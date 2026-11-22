import { DarkTheme, DefaultTheme } from 'expo-router';

import { darkColors, lightColors } from './colors';
import { DYSLEXIA_FONT_BOLD, DYSLEXIA_FONT_REGULAR } from './fonts';
import { navigationTheme } from './navigationTheme';
import { getTheme } from './theme';

describe('navigationTheme', () => {
  it('is the dark navigation theme with our colours by default', () => {
    const nav = navigationTheme(getTheme('dark', false));
    expect(nav.dark).toBe(true);
    expect(nav.fonts).toBe(DarkTheme.fonts);
    expect(nav.colors).toMatchObject({
      primary: darkColors.primaryText,
      background: darkColors.background,
      card: darkColors.surface,
      text: darkColors.text,
      border: darkColors.border,
    });
  });

  it('follows the light theme and the dyslexia font', () => {
    const nav = navigationTheme(getTheme('light', true));
    expect(nav.dark).toBe(DefaultTheme.dark);
    expect(nav.colors.background).toBe(lightColors.background);
    expect(nav.colors.primary).toBe(lightColors.primaryText);
    expect(nav.fonts.regular.fontFamily).toBe(DYSLEXIA_FONT_REGULAR);
    expect(nav.fonts.bold.fontFamily).toBe(DYSLEXIA_FONT_BOLD);
  });

  it('is built once per theme', () => {
    const theme = getTheme('light', false);
    expect(navigationTheme(theme)).toBe(navigationTheme(theme));
  });
});
