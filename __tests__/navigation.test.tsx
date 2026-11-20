import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

describe('navigation shell', () => {
  it('renders the profile picker at /', async () => {
    useAppStore.setState({ hydrated: true });
    await renderRouter('./app', { initialUrl: '/' });
    // The native header title is not part of the test tree; check the picker's own heading.
    expect(await screen.findByText(t.roster.profiles.heading)).toBeTruthy();
  });
});

describe('header back after a deep link (no history)', () => {
  beforeEach(() => {
    const s = useAppStore.getState();
    s.resetAll();
    const profile = s.addProfile({ name: 'Coach', color: '#FF6B00' });
    s.selectProfile(profile.id);
    const team = s.addTeam({ profileId: profile.id, name: 'Herren 1' });
    const match = s.addMatch({
      teamId: team.id,
      opponent: 'Rivals',
      date: '2026-11-21',
      home: true,
    });
    useAppStore.setState({ hydrated: true });
    ids = { team: team.id, match: match.id };
  });
  let ids = { team: '', match: '' };

  it('goes from rotation to the match, then to the team', async () => {
    await renderRouter('./app', { initialUrl: `/match/${ids.match}/rotation?set=1` });
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname(`/match/${ids.match}`);
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname(`/team/${ids.team}`);
  });

  it('shows a not-found page for unknown URLs', async () => {
    await renderRouter('./app', { initialUrl: '/does/not/exist' });
    expect(await screen.findByText(t.common.pageNotFound)).toBeTruthy();
  });
});
