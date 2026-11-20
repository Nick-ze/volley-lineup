import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { useAppStore } from '@/store';

describe('navigation shell', () => {
  it('renders the profile picker at /', async () => {
    useAppStore.setState({ hydrated: true });
    await renderRouter('./app', { initialUrl: '/' });
    expect(await screen.findAllByText('Profiles')).not.toHaveLength(0);
  });
});
