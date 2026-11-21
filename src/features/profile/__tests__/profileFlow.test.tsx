import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

const store = () => useAppStore.getState();
const p = t.profile;

function seed() {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().addProfile({ name: 'Other', color: '#3D8BFF' });
  const team = store().addTeam({ profileId: coach.id, name: 'Herren 1' });
  store().addTeam({ profileId: coach.id, name: 'Damen 2' });
  for (const n of [1, 2, 3]) {
    store().addPlayer({
      teamId: team.id,
      firstName: 'P',
      lastName: `${n}`,
      number: n,
      positions: ['OH'],
      active: true,
    });
  }
  store().selectProfile(coach.id);
  return { coach, team };
}

const pressTab = async (label: string) => fireEvent.press(screen.getByLabelText(label));

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
});

describe('bottom tab bar', () => {
  it('shows Teams, Profile and Settings and switches between them', async () => {
    seed();
    await renderRouter('./app', { initialUrl: '/teams' });
    expect(await screen.findByText(t.roster.teams.heading('Coach'))).toBeTruthy();
    for (const label of [p.tabs.teamsLabel, p.tabs.profileLabel, p.tabs.settingsLabel]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    // The tab bar replaces the old header "Settings" and "Switch profile" buttons on Teams.
    expect(screen.queryByRole('button', { name: p.switch })).toBeNull();

    await pressTab(p.tabs.profileLabel);
    expect(screen).toHavePathname('/profile');
    expect(await screen.findByTestId('profile-screen')).toBeTruthy();

    await pressTab(p.tabs.settingsLabel);
    expect(screen).toHavePathname('/settings');
    expect(await screen.findByTestId('settings-screen')).toBeTruthy();

    await pressTab(p.tabs.teamsLabel);
    expect(screen).toHavePathname('/teams');
  });

  it('detail screens are pushed over the tabs and keep a back button', async () => {
    const { team } = seed();
    await renderRouter('./app', { initialUrl: '/teams' });
    await fireEvent.press(await screen.findByLabelText(t.roster.teams.open('Herren 1')));
    expect(screen).toHavePathname(`/team/${team.id}`);
    await fireEvent.press(await screen.findByTestId('header-back'));
    expect(screen).toHavePathname('/teams');
  });
});

describe('profile tab', () => {
  it('shows the profile with counts and saves an edited name and colour', async () => {
    const { coach } = seed();
    await renderRouter('./app', { initialUrl: '/profile' });
    expect(await screen.findByText('Coach')).toBeTruthy();
    expect(screen.getByText(p.counts(2, 3))).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(p.editLabel('Coach')));
    await fireEvent.changeText(screen.getByLabelText(t.roster.profiles.name), '  ');
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    expect(screen.getByText(t.roster.errors.required)).toBeTruthy();
    expect(store().profiles[0].name).toBe('Coach');

    await fireEvent.changeText(screen.getByLabelText(t.roster.profiles.name), 'Trainer');
    await fireEvent.press(screen.getByRole('radio', { name: t.roster.profiles.colorOption(3) }));
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    expect(store().profiles[0]).toMatchObject({ id: coach.id, name: 'Trainer', color: '#3D8BFF' });
    expect(screen.getByText('Trainer')).toBeTruthy();

    // Cancel keeps the profile unchanged.
    await fireEvent.press(screen.getByLabelText(p.editLabel('Trainer')));
    await fireEvent.changeText(screen.getByLabelText(t.roster.profiles.name), 'Nope');
    await fireEvent.press(screen.getByRole('button', { name: t.common.cancel }));
    expect(store().profiles[0].name).toBe('Trainer');
  });

  it('logs out to the picker, clears the selection and does not auto-forward', async () => {
    seed();
    // App start with a remembered profile: the picker forwards to /teams (DECISIONS #28).
    await renderRouter('./app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/teams'));
    await pressTab(p.tabs.profileLabel);
    expect(screen.getByText(p.logoutNote)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('logout'));
    expect(store().currentProfileId).toBeNull();
    expect(screen).toHavePathname('/');
    expect(await screen.findByText(t.roster.profiles.heading)).toBeTruthy();
    // No auto-redirect back into the profile, and no history into a logged-out tab.
    await act(async () => {
      jest.runOnlyPendingTimers(); // renderRouter uses fake timers
    });
    expect(screen).toHavePathname('/');
    expect(router.canGoBack()).toBe(false);

    // Log back in.
    await fireEvent.press(screen.getByLabelText(t.roster.profiles.select('Coach')));
    expect(screen).toHavePathname('/teams');
    expect(store().currentProfileId).toBe(store().profiles[0].id);
  });

  it('logging out after picking a profile pops the tabs off the stack', async () => {
    seed();
    store().selectProfile(null);
    await renderRouter('./app', { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText(t.roster.profiles.select('Other')));
    expect(screen).toHavePathname('/teams');
    await pressTab(p.tabs.profileLabel);
    await fireEvent.press(screen.getByRole('button', { name: p.switch }));
    expect(screen).toHavePathname('/');
    expect(store().currentProfileId).toBeNull();
    expect(router.canGoBack()).toBe(false);
  });

  it('deletes the profile after confirmation and returns to the picker', async () => {
    const { coach } = seed();
    await renderRouter('./app', { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByLabelText(p.deleteLabel('Coach')));
    expect(screen.getByText(t.roster.confirm.deleteProfile('Coach'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.common.cancel }));
    expect(store().profiles).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText(p.deleteLabel('Coach')));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().profiles.map((x) => x.name)).toEqual(['Other']);
    expect(store().teams.filter((x) => x.profileId === coach.id)).toHaveLength(0);
    expect(store().currentProfileId).toBeNull();
    expect(screen).toHavePathname('/');
    expect(await screen.findByText(t.roster.profiles.heading)).toBeTruthy();
  });

  it('redirects to the picker when no profile is selected', async () => {
    await renderRouter('./app', { initialUrl: '/profile' });
    await waitFor(() => expect(screen).toHavePathname('/'));
  });
});
