import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

// The first renderRouter call transforms every route; on a cold Jest cache (CI) that can take >5 s.
jest.setTimeout(30_000);

describe('navigation shell', () => {
  it('renders the profile picker at /', async () => {
    useAppStore.setState({ hydrated: true });
    await renderRouter('./app', { initialUrl: '/' });
    // The native header title is not part of the test tree; check the picker's own heading.
    expect(await screen.findByText(t.roster.profiles.heading)).toBeTruthy();
  });
});
