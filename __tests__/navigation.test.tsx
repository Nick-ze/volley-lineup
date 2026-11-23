import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { seasonRefs } from '@/test-utils/seasonRefs';

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
      ...seasonRefs(team.id, 'Rivals'),
      opponent: 'Rivals',
      date: '2026-11-21',
      home: true,
    });
    useAppStore.setState({ hydrated: true });
    ids = { team: team.id, match: match.id, season: match.seasonId };
  });
  let ids = { team: '', match: '', season: '' };

  // v7: a match goes back to its season, the season to the team's seasons (Matches tab).
  it('goes from rotation to the match, then to its season, then to the team', async () => {
    await renderRouter('./app', { initialUrl: `/match/${ids.match}/rotation?set=1` });
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname(`/match/${ids.match}`);
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname(`/team/${ids.team}/season/${ids.season}`);
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname(`/team/${ids.team}`);
    expect(screen).toHaveSearchParams({ teamId: ids.team, tab: 'matches' });
  });

  it('a deep link to a team has a back button to the Teams tab', async () => {
    await renderRouter('./app', { initialUrl: `/team/${ids.team}` });
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname('/teams');
    expect(screen.getByLabelText(t.profile.tabs.profileLabel)).toBeTruthy();
  });

  it('tab screens have no back button', async () => {
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByTestId('profile-screen')).toBeTruthy();
    expect(screen.queryByTestId('header-back')).toBeNull();
  });

  it('shows a not-found page for unknown URLs', async () => {
    await renderRouter('./app', { initialUrl: '/does/not/exist' });
    expect(await screen.findByText(t.common.pageNotFound)).toBeTruthy();
  });
});
