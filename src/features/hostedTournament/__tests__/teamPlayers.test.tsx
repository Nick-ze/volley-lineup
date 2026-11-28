/**
 * v12.2: the optional players of a hosted team (the Players section of the team's screen).
 */
import { fireEvent, screen, within } from '@testing-library/react-native';

import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useAppStore } from '@/store';
import { renderApp, resetStores } from '@/test-utils';

const s = t.tournament.players;
const store = () => useAppStore.getState();

beforeEach(() => {
  resetStores();
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
});

function seed() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
  });
  const hosts = store().addHostedTeam(cup.id, 'Hosts');
  const nord = store().addHostedTeam(cup.id, 'TV Nord');
  return { cup, hosts, nord, url: `/tournament/${cup.id}/team/${hosts.id}` };
}

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const add = async (number: string, name: string) => {
  await type('hosted-player-number', number);
  await type('hosted-player-name', name);
  await fireEvent.press(screen.getByTestId('hosted-player-add'));
};
/** The texts of the player rows, top to bottom. */
const rows = () =>
  within(screen.getByTestId('hosted-player-list'))
    .queryAllByTestId(/^hosted-player-(?!edit)/)
    .map((row) =>
      within(row)
        .getAllByText(/./)
        .map((el) => el.props.children as unknown)
        // the icon buttons draw their icons as text: only words and numbers count
        .filter((text): text is string => typeof text === 'string' && /[\p{L}\d]/u.test(text))
        .join(' | '),
    );

describe('players of a tournament team', () => {
  it('are optional: the section says so and starts empty, by number', async () => {
    const { url } = seed();
    await renderApp(url);
    expect(screen.getByRole('header', { name: s.title })).toBeTruthy();
    expect(screen.getByText(s.hint)).toBeTruthy();
    expect(screen.getByTestId('hosted-player-count')).toHaveTextContent(s.empty);
    expect(screen.getByTestId('player-label-number')).toBeChecked();
    expect(rows()).toEqual([]);
  });

  it('adds players with a number, a name or both, and lists them by number', async () => {
    const { url, hosts } = seed();
    await renderApp(url);
    await add('9', '');
    await add('6', ' Kelly ');
    await add('', 'Mia');
    expect(store().hostedPlayers.map((p) => [p.teamId, p.number, p.name])).toEqual([
      [hosts.id, 9, undefined],
      [hosts.id, 6, 'Kelly'],
      [hosts.id, undefined, 'Mia'],
    ]);
    expect(rows()).toEqual(['#6 | Kelly', '#9', 'Mia']);
    expect(screen.getByTestId('hosted-player-count')).toHaveTextContent('3 of 30 players');
    // the fields are empty for the next one
    expect(screen.getByTestId('hosted-player-number').props.value).toBe('');
    expect(screen.getByTestId('hosted-player-name').props.value).toBe('');
  });

  it('shows them by name when the team says so; the number then stands beside it', async () => {
    const { url, hosts } = seed();
    store().addHostedPlayer(hosts.id, { number: 6, name: 'Kelly' });
    store().addHostedPlayer(hosts.id, { number: 9 });
    await renderApp(url);
    expect(rows()).toEqual(['#6 | Kelly', '#9']);
    await fireEvent.press(screen.getByTestId('player-label-name'));
    expect(store().hostedTeams.find((x) => x.id === hosts.id)?.playerLabel).toBe('name');
    expect(screen.getByTestId('player-label-name')).toBeChecked();
    // a player without a name keeps the number
    expect(rows()).toEqual(['Kelly | #6', '#9']);
    await fireEvent.press(screen.getByTestId('player-label-number'));
    expect(rows()).toEqual(['#6 | Kelly', '#9']);
  });

  it('refuses nothing at all, a taken number and a 31st player, each with a text', async () => {
    const { url, hosts, nord } = seed();
    store().addHostedPlayer(hosts.id, { number: 6 });
    store().addHostedPlayer(nord.id, { number: 7 });
    await renderApp(url);
    await fireEvent.press(screen.getByTestId('hosted-player-add'));
    expect(screen.getByText(s.errors.REQUIRED)).toBeTruthy();
    await add('6', 'Twin');
    expect(screen.getByText(s.errors.DUPLICATE_NUMBER)).toBeTruthy();
    expect(store().hostedPlayers).toHaveLength(2);
    // typing takes the text away; another team's number is free
    await type('hosted-player-number', '7');
    expect(screen.queryByText(s.errors.DUPLICATE_NUMBER)).toBeNull();
    await fireEvent(screen.getByTestId('hosted-player-name'), 'submitEditing');
    expect(store().hostedPlayers).toHaveLength(3);

    useAppStore.setState({
      hostedPlayers: Array.from({ length: 30 }, (_, i) => ({
        id: `p${i}`,
        teamId: hosts.id,
        number: i,
      })),
    });
    await add('99', '');
    expect(screen.getByText(s.errors.TOO_MANY(30))).toBeTruthy();
    expect(store().hostedPlayers).toHaveLength(30);
  });

  it('keeps only digits in the number field, three at most', async () => {
    const { url } = seed();
    await renderApp(url);
    await type('hosted-player-number', '1a2b34');
    expect(screen.getByTestId('hosted-player-number').props.value).toBe('123');
  });

  it('edits a player; Cancel leaves them as they were', async () => {
    const { url, hosts } = seed();
    const kelly = store().addHostedPlayer(hosts.id, { number: 6, name: 'Kelly' });
    store().addHostedPlayer(hosts.id, { number: 9 });
    await renderApp(url);
    await press(s.editLabel('#6 Kelly'));
    expect(screen.getByTestId('hosted-player-edit-number').props.value).toBe('6');
    expect(screen.getByTestId('hosted-player-edit-name').props.value).toBe('Kelly');
    await type('hosted-player-edit-number', '9');
    await press(t.common.save);
    expect(screen.getByText(s.errors.DUPLICATE_NUMBER)).toBeTruthy();
    await type('hosted-player-edit-number', '');
    await type('hosted-player-edit-name', 'Kelly B.');
    await press(t.common.save);
    expect(store().hostedPlayers.find((p) => p.id === kelly.id)).toEqual({
      id: kelly.id,
      teamId: hosts.id,
      name: 'Kelly B.',
    });
    expect(screen.queryByTestId(`hosted-player-edit-${kelly.id}`)).toBeNull();

    await press(s.editLabel('Kelly B.'));
    await type('hosted-player-edit-name', 'Changed');
    await press(t.common.cancel);
    expect(store().hostedPlayers.find((p) => p.id === kelly.id)?.name).toBe('Kelly B.');
  });

  it('deletes a player after the question', async () => {
    const { url, hosts } = seed();
    store().addHostedPlayer(hosts.id, { number: 6, name: 'Kelly' });
    await renderApp(url);
    await press(s.deleteLabel('#6 Kelly'));
    expect(screen.getByText(s.confirmDelete('#6 Kelly'))).toBeTruthy();
    await press(t.common.cancel);
    expect(store().hostedPlayers).toHaveLength(1);
    await press(s.deleteLabel('#6 Kelly'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedPlayers).toEqual([]);
    expect(screen.getByTestId('hosted-player-count')).toHaveTextContent(s.empty);
  });

  it('removing the team removes its players', async () => {
    const { cup, hosts, nord } = seed();
    store().addHostedPlayer(hosts.id, { number: 6 });
    const stays = store().addHostedPlayer(nord.id, { number: 7 });
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    await press(t.tournament.teams.deleteLabel('Hosts'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedPlayers).toEqual([stays]);
  });

  it('is in German when the language is German', async () => {
    const { url, hosts } = seed();
    store().addHostedPlayer(hosts.id, { number: 6, name: 'Kelly' });
    useAppStore.setState({ language: 'de' });
    await renderApp(url);
    expect(screen.getByRole('header', { name: 'Spieler' })).toBeTruthy();
    expect(screen.getByText(de.tournament.players.shownBy)).toBeTruthy();
    expect(screen.getByTestId('hosted-player-count')).toHaveTextContent('1 von 30 Spielern');
    expect(screen.getByRole('button', { name: 'Hinzufügen: Spieler' })).toBeTruthy();
  });
});
