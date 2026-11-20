import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { t } from '@/i18n/en';
import { STORAGE_KEY, useAppStore } from '@/store';

import { resetStartupRedirect } from '../hooks/useStartupRedirect';

const s = t.roster;
const store = () => useAppStore.getState();

beforeEach(async () => {
  store().resetAll();
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
  await AsyncStorage.clear();
});

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

async function addPlayer(first: string, last: string, number: number, positions: string[]) {
  await press(s.roster.addPlayer);
  await screen.findByLabelText(s.player.firstName);
  await type(s.player.firstName, first);
  await type(s.player.lastName, last);
  await type(s.player.number, String(number));
  for (const p of positions) await fireEvent.press(screen.getByTestId(`position-${p}`));
  await press(t.common.save);
}

function seedTeam() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  return { profile, team };
}

describe('roster flows', () => {
  it('creates a profile, a team and 12 players, and persists them', async () => {
    await renderRouter('./app', { initialUrl: '/' });

    // No profiles: the create form is open straight away.
    await type(s.profiles.name, 'Coach');
    await press(s.profiles.create);
    expect(store().profiles.map((p) => p.name)).toEqual(['Coach']);

    await press(s.profiles.select('Coach'));
    expect(screen).toHavePathname('/teams');
    expect(store().currentProfileId).toBe(store().profiles[0].id);

    await press(s.teams.new);
    await type(s.teams.name, 'Herren 1');
    await type(s.teams.season, '2026/27');
    await press(s.teams.create);
    await press(s.teams.open('Herren 1'));
    expect(screen).toHavePathname(`/team/${store().teams[0].id}`);

    const positions = ['S', 'OH', 'MB', 'OPP', 'L', 'DS'];
    for (let i = 1; i <= 12; i++) {
      await addPlayer(`First${i}`, `Last${i}`, i, [positions[i % 6]]);
      expect(screen).toHavePathname(`/team/${store().teams[0].id}`);
    }
    expect(store().players).toHaveLength(12);
    expect(screen.getByText(s.team.playerCount(12))).toBeTruthy();
    expect(screen.getByTestId('player-12')).toBeTruthy();

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(JSON.parse(raw as string).state.players).toHaveLength(12);
  }, 60_000);

  it('rejects a duplicate jersey number and shows validation errors', async () => {
    const { team } = seedTeam();
    store().addPlayer({
      teamId: team.id,
      firstName: 'Ana',
      lastName: 'Ace',
      number: 7,
      positions: ['S'],
      active: true,
    });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/player` });

    await press(t.common.save);
    expect(screen.getAllByText(s.errors.required)).toHaveLength(4);

    await type(s.player.firstName, 'Ben');
    await type(s.player.lastName, 'Block');
    await type(s.player.number, '7');
    await fireEvent.press(screen.getByTestId('position-MB'));
    await press(t.common.save);
    expect(screen.getByText(s.errors.taken)).toBeTruthy();
    expect(store().players).toHaveLength(1);

    await type(s.player.number, '8');
    await press(t.common.save);
    expect(
      store()
        .players.map((p) => p.number)
        .sort(),
    ).toEqual([7, 8]);
  });

  it('edits a player, changes the primary position and toggles injured', async () => {
    const { team } = seedTeam();
    const p = store().addPlayer({
      teamId: team.id,
      firstName: 'Ana',
      lastName: 'Ace',
      number: 7,
      positions: ['S', 'OH'],
      active: true,
    });
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await press(s.roster.toggleActive('Ana Ace', true));
    expect(store().players[0].active).toBe(false);

    await fireEvent.press(screen.getByTestId('player-7'));
    await screen.findByLabelText(s.player.firstName);
    expect(screen.getByLabelText(s.player.firstName).props.value).toBe('Ana');
    await fireEvent.press(
      screen.getByRole('radio', { name: s.player.makePrimary(t.positions.OH) }),
    );
    await type(s.player.number, '7'); // own number is fine
    await fireEvent.press(
      screen.getByRole('switch', { name: s.player.activeLabel, checked: false }),
    );
    expect(screen.getByRole('switch', { name: s.player.activeLabel, checked: true })).toBeTruthy();
    await press(t.common.save);
    expect(store().players[0]).toMatchObject({
      id: p.id,
      positions: ['OH', 'S'],
      number: 7,
      active: true,
    });
  });

  it('deletes a player after confirmation', async () => {
    const { team } = seedTeam();
    const p = store().addPlayer({
      teamId: team.id,
      firstName: 'Ana',
      lastName: 'Ace',
      number: 7,
      positions: ['S'],
      active: true,
    });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/player?playerId=${p.id}` });
    await press(s.player.delete);
    expect(screen.getByText(s.confirm.deletePlayer('Ana Ace'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().players).toHaveLength(0);
  });

  it('creates a match and opens it', async () => {
    const { team } = seedTeam();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await fireEvent.press(screen.getByRole('tab', { name: s.team.matchesTab }));
    expect(screen.getByText(s.matches.empty)).toBeTruthy();
    await press(s.matches.newMatch);

    await screen.findByLabelText(s.matchForm.opponent);
    await type(s.matchForm.date, '2026-02-30');
    await press(s.matchForm.create);
    expect(screen.getByText(s.errors.required)).toBeTruthy();
    expect(screen.getByText(s.errors.invalidDate)).toBeTruthy();

    await type(s.matchForm.opponent, 'Rivals');
    await type(s.matchForm.date, '2026-11-21');
    await fireEvent.press(screen.getByRole('radio', { name: s.matches.away }));
    await press(s.matchForm.create);

    const match = store().matches[0];
    expect(match).toMatchObject({ opponent: 'Rivals', date: '2026-11-21', home: false });
    expect(match.sets).toHaveLength(1);
    expect(screen).toHavePathname(`/match/${match.id}`);
  });

  it('lists matches newest first and deletes one after confirmation', async () => {
    const { team } = seedTeam();
    store().addMatch({ teamId: team.id, opponent: 'Old', date: '2026-01-01', home: true });
    store().addMatch({ teamId: team.id, opponent: 'New', date: '2026-10-01', home: false });
    await renderRouter('./app', { initialUrl: `/team/${team.id}?tab=matches` });
    const rows = screen.getAllByText(/^vs /).map((n) => n.props.children);
    expect(rows).toEqual(['vs New', 'vs Old']);
    await press(s.matches.delete('Old'));
    await press(t.common.cancel);
    expect(store().matches).toHaveLength(2);
    await press(s.matches.delete('Old'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().matches.map((m) => m.opponent)).toEqual(['New']);
  });

  it('renames and deletes profiles and teams', async () => {
    const { profile } = seedTeam();
    await renderRouter('./app', { initialUrl: '/teams' });

    await press(s.teams.rename('Herren 1'));
    await type(s.teams.name, 'Herren 2');
    await press(t.common.save);
    expect(store().teams[0].name).toBe('Herren 2');
    await press(s.teams.delete('Herren 2'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().teams).toHaveLength(0);

    await press(s.teams.switchProfile);
    expect(screen).toHavePathname('/');
    await press(s.profiles.rename('Coach'));
    await type(s.profiles.name, 'Trainer');
    await fireEvent.press(screen.getByRole('radio', { name: s.profiles.colorOption(3) }));
    await press(t.common.save);
    expect(store().profiles[0]).toMatchObject({ id: profile.id, name: 'Trainer' });
    expect(store().profiles[0].color).not.toBe('#FF6B00');

    await press(s.profiles.delete('Trainer'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().profiles).toHaveLength(0);
  });

  it('jumps to /teams on start when a profile is selected, but only once', async () => {
    seedTeam();
    await renderRouter('./app', { initialUrl: '/' });
    await waitFor(() => expect(screen).toHavePathname('/teams'));
    await press(s.teams.switchProfile);
    expect(screen).toHavePathname('/');
    expect(screen.getByText(s.profiles.heading)).toBeTruthy();
  });

  it('redirects /teams to the picker without a selected profile', async () => {
    await renderRouter('./app', { initialUrl: '/teams' });
    await waitFor(() => expect(screen).toHavePathname('/'));
  });

  it("refuses to edit a player through another team's URL", async () => {
    const { profile, team } = seedTeam();
    const other = store().addTeam({ profileId: profile.id, name: 'Damen' });
    const p = store().addPlayer({
      teamId: other.id,
      firstName: 'Ana',
      lastName: 'Ace',
      number: 7,
      positions: ['S'],
      active: true,
    });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/player?playerId=${p.id}` });
    expect(screen.getByText(s.player.notFound)).toBeTruthy();
    expect(screen.getByRole('button', { name: s.backToTeam })).toBeTruthy();
  });

  it('shows not-found for an unknown team', async () => {
    await renderRouter('./app', { initialUrl: '/team/nope' });
    expect(screen.getByText(s.teamNotFound)).toBeTruthy();
  });
});
