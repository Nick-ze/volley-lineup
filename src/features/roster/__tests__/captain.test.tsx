import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { PlayerChip } from '@/components';
import { buildLineupSheetHtml } from '@/domain/lineupSheet';
import { playerDescription } from '@/features/live/format';
import { sheetLabels } from '@/features/print/sheetLabels';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { seedGolden } from '@/test-utils';

import { resetStartupRedirect } from '../hooks/useStartupRedirect';

const s = t.roster;
const store = () => useAppStore.getState();
const captainOf = (teamId: string) => store().teams.find((x) => x.id === teamId)?.captainId;

function seed() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const team = store().addTeam({ profileId: profile.id, name: 'Herren 1' });
  const add = (firstName: string, number: number) =>
    store().addPlayer({
      teamId: team.id,
      firstName,
      lastName: 'Meier',
      number,
      positions: ['OH'],
      active: true,
    });
  return { team, anna: add('Anna', 7), bea: add('Bea', 3) };
}

const captainSwitch = (checked: boolean) =>
  screen.getByRole('switch', { name: s.player.captainLabel, checked });

const openForm = (teamId: string, playerId?: string) =>
  renderRouter('./app', {
    initialUrl: `/team/${teamId}/player${playerId ? `?playerId=${playerId}` : ''}`,
  });

beforeEach(() => {
  store().resetAll();
  store().setLanguage('en');
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
});

describe('player form: Team captain switch (v9.1)', () => {
  it('turning it on makes the player the captain, with the hint under it', async () => {
    const { team, anna } = seed();
    await openForm(team.id, anna.id);
    expect(screen.getByText(s.player.captainHint)).toBeTruthy();
    // screen readers hear the hint with the switch
    expect(captainSwitch(false).props.accessibilityHint).toBe(s.player.captainHint);
    await fireEvent.press(captainSwitch(false));
    expect(captainOf(team.id)).toBeUndefined(); // only on save
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    expect(captainOf(team.id)).toBe(anna.id);
  });

  it('moves the captain: the previous captain loses it', async () => {
    const { team, anna, bea } = seed();
    store().setCaptain(team.id, anna.id, true);
    await openForm(team.id, bea.id);
    await fireEvent.press(captainSwitch(false));
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    expect(captainOf(team.id)).toBe(bea.id);
  });

  it('turning it off clears the captain; cancel changes nothing', async () => {
    const { team, anna } = seed();
    store().setCaptain(team.id, anna.id, true);
    await openForm(team.id, anna.id);
    await fireEvent.press(captainSwitch(true));
    expect(captainSwitch(false)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.common.cancel }));
    expect(captainOf(team.id)).toBe(anna.id);
  });

  it('saving with the switch off clears it', async () => {
    const { team, anna } = seed();
    store().setCaptain(team.id, anna.id, true);
    await openForm(team.id, anna.id);
    await fireEvent.press(captainSwitch(true));
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    expect(store().teams[0]).not.toHaveProperty('captainId');
  });

  it('a new player can be added as the captain', async () => {
    const { team, anna } = seed();
    store().setCaptain(team.id, anna.id, true);
    await openForm(team.id);
    await fireEvent.changeText(screen.getByLabelText(s.player.firstName), 'Cleo');
    await fireEvent.changeText(screen.getByLabelText(s.player.lastName), 'Neu');
    await fireEvent.changeText(screen.getByLabelText(s.player.number), '11');
    await fireEvent.press(screen.getByTestId('position-S'));
    await fireEvent.press(captainSwitch(false));
    await fireEvent.press(screen.getByRole('button', { name: t.common.save }));
    const cleo = store().players.find((p) => p.number === 11);
    expect(captainOf(team.id)).toBe(cleo?.id);
  });
});

describe('captain badge and labels (v9.1)', () => {
  it('the roster card of the captain only has the badge, and its label says captain', async () => {
    const { team, anna } = seed();
    store().setCaptain(team.id, anna.id, true);
    await renderRouter('./app', { initialUrl: `/team/${team.id}` });
    await screen.findByTestId('roster-grid');
    expect(screen.getByTestId('player-7-captain', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('player-3-captain', { includeHiddenElements: true })).toBeNull();
    const label = s.roster.cardLabel('Anna Meier', 7, t.positions.OH, true, true);
    expect(label).toBe('Anna Meier, number 7, captain, Outside Hitter. Open details');
    expect(screen.getByRole('button', { name: label })).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: s.roster.cardLabel('Bea Meier', 3, t.positions.OH, true),
      }),
    ).toBeTruthy();
  });

  it('a player chip shows the badge only for the captain and says so (EN + DE)', async () => {
    const { team, anna, bea } = seed();
    store().setCaptain(team.id, anna.id, true);
    await render(
      <>
        <PlayerChip player={anna} testID="chip-anna" />
        <PlayerChip player={bea} testID="chip-bea" />
      </>,
    );
    expect(screen.getByTestId('chip-anna-captain', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('chip-bea-captain', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByLabelText('Number 7, Anna Meier, captain, Outside Hitter')).toBeTruthy();
    expect(screen.getByLabelText('Number 3, Bea Meier, Outside Hitter')).toBeTruthy();
    expect(de.player.chipLabel(7, 'Anna Meier', 'Außen', true)).toBe(
      'Nummer 7, Anna Meier, Kapitän, Außen',
    );
  });

  it('the player detail shows "Captain" for the captain', async () => {
    const { team, anna } = seed();
    store().setCaptain(team.id, anna.id, true);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/players/${anna.id}` });
    expect(await screen.findByTestId('player-captain')).toBeTruthy();
    expect(screen.getByText(t.playerDetail.captain)).toBeTruthy();
    expect(screen.getByTestId('player-header').props.accessibilityLabel).toContain(', captain, ');
  });

  it('the player detail of another player shows no captain', async () => {
    const { team, anna, bea } = seed();
    store().setCaptain(team.id, anna.id, true);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/players/${bea.id}` });
    await screen.findByTestId('player-header');
    expect(screen.queryByTestId('player-captain')).toBeNull();
    expect(screen.queryByText(t.playerDetail.captain)).toBeNull();
  });

  it('live court descriptions name the captain', () => {
    const { team, anna, bea } = seed();
    store().setCaptain(team.id, anna.id, true);
    const captainId = store().teams[0].captainId;
    expect(playerDescription(t, anna, captainId)).toBe(
      'Number 7, Anna Meier, captain, Outside Hitter',
    );
    expect(playerDescription(t, bea, captainId)).toBe('Number 3, Bea Meier, Outside Hitter');
  });

  it('the print sheet marks the captain (C) (golden data: Lea Schmid captains t1)', () => {
    const data = seedGolden('en');
    const team = data.teams.find((x) => x.id === 't1');
    const match = data.matches.find((m) => m.teamId === 't1');
    if (!team || !match) throw new Error('golden data changed');
    const html = buildLineupSheetHtml({
      match,
      team,
      players: data.players,
      labels: sheetLabels(t, team.name, match.opponent),
    });
    expect(html).toContain('Lea Schmid (C)');
    expect(html).not.toContain('Anna Meier (C)');
    expect(html.match(/\(C\)/g)?.length).toBeGreaterThan(1);
  });
});
