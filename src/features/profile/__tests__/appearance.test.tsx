import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { buildExport } from '@/domain/exportSchema';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { transferSnapshot } from '@/store/photoStore';
import { darkColors, DYSLEXIA_FONT_BOLD, DYSLEXIA_FONT_REGULAR, lightColors } from '@/theme';

const store = () => useAppStore.getState();
const a = t.appearance;

function seed() {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(coach.id);
}

const flat = (testId: string) => StyleSheet.flatten(screen.getByTestId(testId).props.style);

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  store().setThemeMode('dark');
  store().setDyslexiaFont(false);
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
});

describe('Profile tab — Appearance', () => {
  it('switches Dark / Light / System and the whole screen follows', async () => {
    seed();
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByText(a.title)).toBeTruthy();
    expect(screen.getByRole('radio', { name: a.themeOption(a.themeDark) })).toBeChecked();
    expect(flat('profile-screen').backgroundColor).toBe(darkColors.background);

    await fireEvent.press(screen.getByRole('radio', { name: a.themeOption(a.themeLight) }));
    expect(store().themeMode).toBe('light');
    expect(flat('profile-screen').backgroundColor).toBe(lightColors.background);
    expect(screen.getByRole('radio', { name: a.themeOption(a.themeLight) })).toBeChecked();
    expect(screen.getByRole('radio', { name: a.themeOption(a.themeDark) })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: a.themeOption(a.themeSystem) }));
    expect(store().themeMode).toBe('system');
    await fireEvent.press(screen.getByRole('radio', { name: a.themeOption(a.themeDark) }));
    expect(store().themeMode).toBe('dark');
    expect(flat('profile-screen').backgroundColor).toBe(darkColors.background);
  });

  it('turns the dyslexia-friendly font on for the text and off again', async () => {
    seed();
    await renderRouter('./app', { initialUrl: '/profile' });
    const title = await screen.findByText(a.title);
    expect(StyleSheet.flatten(title.props.style).fontFamily).toBeUndefined();

    const toggle = screen.getByRole('switch', { name: a.dyslexiaFont });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(store().dyslexiaFont).toBe(true);
    expect(screen.getByRole('switch', { name: a.dyslexiaFont })).toBeChecked();
    // Section titles are bold (bold family); body text uses the regular family.
    expect(StyleSheet.flatten(screen.getByText(a.title).props.style).fontFamily).toBe(
      DYSLEXIA_FONT_BOLD,
    );
    expect(StyleSheet.flatten(screen.getByText(a.dyslexiaFont).props.style).fontFamily).toBe(
      DYSLEXIA_FONT_REGULAR,
    );

    await fireEvent.press(screen.getByRole('switch', { name: a.dyslexiaFont }));
    expect(store().dyslexiaFont).toBe(false);
    expect(StyleSheet.flatten(screen.getByText(a.title).props.style).fontFamily).toBeUndefined();
  });

  it('keeps both settings on "Delete all data" and never exports them', async () => {
    seed();
    store().setThemeMode('light');
    store().setDyslexiaFont(true);
    const text = JSON.stringify(buildExport(await transferSnapshot()));
    expect(text).not.toContain('themeMode');
    expect(text).not.toContain('dyslexiaFont');

    store().resetAll();
    expect(store().themeMode).toBe('light');
    expect(store().dyslexiaFont).toBe(true);
  });

  it('shows the German labels', async () => {
    seed();
    store().setLanguage('de');
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByText('Darstellung')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Hell (Design)' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Legasthenie-freundliche Schrift' })).toBeTruthy();
  });
});
