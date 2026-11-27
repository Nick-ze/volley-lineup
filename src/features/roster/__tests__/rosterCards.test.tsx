import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { t } from '@/i18n/en';
import { useAppStore, usePhotoStore } from '@/store';

import { resetStartupRedirect } from '../hooks/useStartupRedirect';

const s = t.roster.roster;
const store = () => useAppStore.getState();

function seed() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  const add = (firstName: string, lastName: string, number: number, extra = {}) =>
    store().addPlayer({
      teamId: team.id,
      firstName,
      lastName,
      number,
      positions: ['OH', 'OPP'],
      active: true,
      ...extra,
    });
  const anna = add('Anna', 'Meier', 7, { description: 'Secret knee note' });
  add('Bea', 'Keller', 3);
  add('Maximiliane-Alexandra', 'Von Hohenzollern-Sigmaringen', 12);
  return { team, anna };
}

const cardWidth = (n: number) =>
  StyleSheet.flatten(screen.getByTestId(`player-${n}-card`).props.style).width as number;

const layout = async (width: number) =>
  fireEvent(screen.getByTestId('roster-grid'), 'layout', {
    nativeEvent: { layout: { width, height: 500, x: 0, y: 0 } },
  });

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
});

describe('roster player cards (v8)', () => {
  it('shows a card per player by number, first name first, 2 columns on a phone', async () => {
    const { team } = seed();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    const grid = await screen.findByTestId('roster-grid');
    const cards = within(grid).getAllByTestId(/^player-\d+-card$/);
    expect(cards.map((c) => c.props.testID)).toEqual([
      'player-3-card',
      'player-7-card',
      'player-12-card',
    ]);
    expect(screen.getByTestId('player-7-name')).toHaveTextContent('Anna Meier');
    expect(screen.getByTestId('player-7-number')).toHaveTextContent('#7');
    expect(within(cards[1]).getByText('OH')).toBeTruthy();
    expect(within(cards[1]).getByText('OPP')).toBeTruthy();
    // The card's label starts with the visible name.
    expect(
      screen.getByRole('button', {
        name: s.cardLabel('Anna Meier', 7, 'Outside Hitter, Opposite', true),
      }),
    ).toBeTruthy();
    // Long names wrap onto two lines at most (and truncate after that).
    expect(screen.getByTestId('player-12-name').props.numberOfLines).toBe(2);

    // 375 px screen: 343 px of content → 2 columns of 167 px.
    await layout(343);
    expect(cardWidth(7)).toBe(167);
    // 1280 px screen: the 1100 px content width minus padding → 5 columns.
    await layout(1068);
    expect(cardWidth(7)).toBe(207);
  });

  it('shows the picture in full as a square across the card, the text below (v8.2)', async () => {
    const { team, anna } = seed();
    usePhotoStore.setState({ photos: { pa: 'data:image/jpeg;base64,AAAA' }, hydrated: true });
    store().updatePlayer(anna.id, { photoId: 'pa' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await layout(343);
    const card = within(screen.getByTestId('player-7-card'));
    const photo = StyleSheet.flatten(
      card.getByTestId('photo', { includeHiddenElements: true }).props.style,
    );
    // The whole 167 px card (v11: the card has no border any more); square, not a circle.
    expect(photo.width).toBe(167);
    expect(photo.height).toBe(167);
    expect(photo.borderRadius).toBe(0);
  });

  it('never shows the description on a card', async () => {
    const { team } = seed();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await screen.findByTestId('roster-grid');
    expect(screen.queryByText(/Secret knee note/)).toBeNull();
  });

  it('opens the player detail when a card is tapped', async () => {
    const { team, anna } = seed();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await fireEvent.press(await screen.findByTestId('player-7'));
    expect(screen).toHavePathname(`/team/${team.id}/players/${anna.id}`);
  });

  it('toggles active / injured on the card without opening the detail', async () => {
    const { team } = seed();
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    const toggle = await screen.findByRole('switch', { name: s.toggleActive('Anna Meier', true) });
    expect(toggle).toHaveTextContent(s.active);
    expect(toggle).toBeChecked();
    await fireEvent.press(toggle);
    expect(store().players.find((p) => p.number === 7)?.active).toBe(false);
    expect(screen).toHavePathname(`/team/${team.id}`);

    const injured = screen.getByRole('switch', { name: s.toggleActive('Anna Meier', false) });
    expect(injured).toHaveTextContent(s.inactive);
    expect(injured).not.toBeChecked();
    await fireEvent.press(injured);
    expect(store().players.find((p) => p.number === 7)?.active).toBe(true);
  });

  it('keeps Add player and the empty state', async () => {
    const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
    store().selectProfile(profile.id);
    const team = store().addTeam({ profileId: profile.id, name: 'Empty' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    expect(await screen.findByText(s.empty)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: s.addPlayer }));
    expect(screen).toHavePathname(`/team/${team.id}/player`);
  });
});
