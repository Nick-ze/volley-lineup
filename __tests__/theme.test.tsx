import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';

import { seedTeam } from '@/features/presets/__fixtures__/team';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { darkColors, DYSLEXIA_FONT_BOLD, DYSLEXIA_FONT_REGULAR, lightColors } from '@/theme';

const flat = (testIdOrText: { props: { style?: unknown } }) =>
  StyleSheet.flatten(testIdOrText.props.style as Parameters<typeof StyleSheet.flatten>[0]) ?? {};

beforeEach(seedTeam);
afterEach(() => {
  useAppStore.getState().setThemeMode('dark');
  useAppStore.getState().setDyslexiaFont(false);
});

describe('v8 theme on real screens', () => {
  it('the team screen is dark by default', async () => {
    await renderRouter('./app', { initialUrl: '/team/team1' });
    expect(flat(await screen.findByTestId('team-nav')).backgroundColor).toBe(darkColors.surface);
    expect(flat(screen.getByText(t.roster.team.playerCount(12))).color).toBe(darkColors.textMuted);
  });

  it('the team screen follows the light theme', async () => {
    useAppStore.getState().setThemeMode('light');
    await renderRouter('./app', { initialUrl: '/team/team1' });
    expect(flat(await screen.findByTestId('team-nav')).backgroundColor).toBe(lightColors.surface);
    expect(flat(screen.getByText(t.roster.team.playerCount(12))).color).toBe(lightColors.textMuted);
  });

  it('the dyslexia font reaches every text style', async () => {
    useAppStore.getState().setDyslexiaFont(true);
    await renderRouter('./app', { initialUrl: '/team/team1' });
    await screen.findByTestId('team-nav');
    // Labels (weight 600) use the bold family and drop the weight …
    const caption = flat(screen.getByText(t.roster.team.playerCount(12)));
    expect(caption.fontFamily).toBe(DYSLEXIA_FONT_BOLD);
    expect(caption.fontWeight).toBeUndefined();
    // … and every text on the screen (header and tab bar included) has one of the two
    // families; icons keep their icon font.
    const families = new Set(
      screen
        .getAllByText(/./)
        .map((node) => flat(node).fontFamily as string | undefined)
        .filter((family) => family !== 'ionicons'),
    );
    expect([...families].sort()).toEqual([DYSLEXIA_FONT_BOLD, DYSLEXIA_FONT_REGULAR]);
  });
});

/** Every source file under a folder (tests and fixtures excluded). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === '__tests__' || name === '__fixtures__' ? [] : sources(path);
    }
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('no colours outside src/theme', () => {
  it('has no hex or rgb colour literals in app/ and src/ (except src/theme)', () => {
    const root = join(__dirname, '..');
    const files = [...sources(join(root, 'app')), ...sources(join(root, 'src'))].filter(
      (f) => !f.startsWith(join(root, 'src', 'theme')),
    );
    const offenders = files.filter((f) =>
      /['"`]#[0-9a-fA-F]{3,8}['"`]|rgba?\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
