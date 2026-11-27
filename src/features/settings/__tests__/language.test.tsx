import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { de } from '@/i18n/de';
import { en } from '@/i18n/en';
import { useAppStore } from '@/store';
import { STORAGE_KEY } from '@/store/appStore';

const store = () => useAppStore.getState();

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  useAppStore.setState({ hydrated: true });
});

afterAll(() => store().setLanguage('en'));

describe('language setting', () => {
  it('switches the whole app to German and back, including screens below in the stack', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    // v11: the Teams title is the same word in both languages; its "New team" button isn't.
    expect(await screen.findByText(en.roster.teams.new)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(en.profile.tabs.settingsLabel));
    expect(await screen.findByTestId('settings-screen')).toBeTruthy();
    const deutsch = screen.getByTestId('language-de');
    expect(deutsch.props.accessibilityLabel).toBe(en.language.optionLabel('Deutsch'));

    await fireEvent.press(deutsch);
    expect(store().language).toBe('de');
    expect(screen.getByText(de.transfer.danger.hint)).toBeTruthy();
    expect(screen.queryByText(en.transfer.danger.hint)).toBeNull();
    // The tab bar follows the language too.
    expect(screen.getByLabelText(de.profile.tabs.teamsLabel)).toBeTruthy();
    expect(screen.getByLabelText(de.profile.tabs.profileLabel)).toHaveTextContent(
      de.profile.tabs.profile,
      {
        exact: false, // the icon glyph is part of the button's text too
      },
    );
    expect(screen.queryByLabelText(en.profile.tabs.teamsLabel)).toBeNull();
    expect(screen.getByTestId('language-de')).toBeChecked();

    // The teams tab stayed mounted; it must not show stale English.
    await fireEvent.press(screen.getByLabelText(de.profile.tabs.teamsLabel));
    expect(await screen.findByText(de.roster.teams.new)).toBeTruthy();
    expect(screen.queryByText(en.roster.teams.new)).toBeNull();

    await fireEvent.press(screen.getByLabelText(de.profile.tabs.settingsLabel));
    await fireEvent.press(await screen.findByTestId('language-en'));
    expect(store().language).toBe('en');
    expect(screen.getByText(en.transfer.danger.hint)).toBeTruthy();
    expect(screen.queryByText(de.transfer.danger.hint)).toBeNull();
    expect(screen.getByLabelText(en.profile.tabs.teamsLabel)).toBeTruthy();
  });

  it('keeps the chosen language across a restart (store rehydrate)', async () => {
    jest.useRealTimers(); // renderRouter in the previous test leaves fake timers on
    store().setLanguage('de');
    await new Promise((r) => setTimeout(r, 0));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string).state.language).toBe('de');

    useAppStore.setState({ language: 'en' }); // also overwrites storage…
    await AsyncStorage.setItem(STORAGE_KEY, raw as string); // …so restore the saved copy
    await useAppStore.persist.rehydrate();
    expect(store().language).toBe('de');

    await renderRouter('./app', { initialUrl: '/settings' });
    expect(await screen.findByText(de.transfer.danger.hint)).toBeTruthy();
  });

  it('keeps the language when all data is deleted', () => {
    store().setLanguage('de');
    store().resetAll();
    expect(store().language).toBe('de');
  });
});
