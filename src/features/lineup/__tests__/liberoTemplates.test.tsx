import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Player, Position } from '@/domain/types';
import { useAppStore } from '@/store';

const player = (n: number, last: string, positions: Position[], active = true): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: last.slice(0, 1),
  lastName: last,
  number: n,
  positions,
  active,
});

/** 12 players: 2 S, 3 OH, 3 MB, 2 OPP, 1 L, 1 DS (one setter injured). */
const roster: Player[] = [
  player(1, 'Setter', ['S']),
  player(2, 'Second', ['S', 'OPP'], false),
  player(3, 'Wing', ['OH']),
  player(4, 'Outside', ['OH']),
  player(5, 'Three', ['OH', 'DS']),
  player(6, 'Block', ['MB']),
  player(7, 'Middle', ['MB']),
  player(8, 'Tall', ['MB', 'OPP']),
  player(9, 'Oppo', ['OPP']),
  player(10, 'Right', ['OPP', 'OH']),
  player(11, 'Dig', ['L']),
  player(12, 'Def', ['DS']),
];

function seed(players: Player[] = roster) {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players,
    matches: [
      { id: 'm1', teamId: 'team1', opponent: 'Rivals', date: '2026-11-20', home: true, sets: [] },
    ],
    currentProfileId: 'prof',
  });
}

const set1 = () => useAppStore.getState().matches[0].sets.find((s) => s.setNumber === 1)!;

async function fillWith(system: '5-1' | '6-2') {
  await fireEvent.press(await screen.findByRole('button', { name: 'Fill from template' }));
  await fireEvent.press(
    screen.getByRole('button', { name: `Fill the starting six with a ${system} system` }),
  );
}

describe('lineup builder — fill from template', () => {
  beforeEach(() => seed());

  it('fills a 5-1 from the roster with only active players', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await fillWith('5-1');
    expect(set1().slots).toEqual({ 1: 'p1', 2: 'p3', 3: 'p6', 4: 'p9', 5: 'p4', 6: 'p7' });
    expect(screen.getByTestId('template-message')).toHaveTextContent('Filled with a 5-1 system.');
    expect(screen.getByText('Lineup is complete.')).toBeTruthy();
  });

  it('lists the positions a 6-2 could not fill and leaves them empty', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await fillWith('6-2');
    // The second setter is injured: position 4 stays empty.
    expect(set1().slots[4]).toBeNull();
    expect(screen.getByTestId('template-message')).toHaveTextContent(
      /Could not fill: position 4 \(Setter\)/,
    );
    expect(screen.getByTestId('slot-empty-4')).toBeTruthy();
  });

  it('can be cancelled without changing anything', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Fill from template' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close the template choice' }));
    expect(useAppStore.getState().matches[0].sets).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Fill from template' })).toBeTruthy();
  });
});

describe('lineup builder — libero replaces', () => {
  beforeEach(() => seed());

  it('defaults to the middles, can be changed, and follows players leaving the court', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await fillWith('5-1');
    // No libero yet → no chooser.
    expect(screen.queryByTestId('libero-replaces')).toBeNull();

    // Tap-to-select: the libero from the bench into the libero slot.
    await fireEvent.press(within(screen.getByTestId('bench')).getByTestId('bench-player-11'));
    await fireEvent.press(screen.getByTestId('libero-empty'));
    expect(set1().liberoId).toBe('p11');

    const chooser = screen.getByTestId('libero-replaces');
    const middle6 = within(chooser).getByRole('checkbox', {
      name: 'Libero replaces number 6 B Block',
    });
    expect(middle6).toBeChecked();
    expect(within(chooser).getByRole('checkbox', { name: /number 7/ })).toBeChecked();
    expect(within(chooser).getByRole('checkbox', { name: /number 1 / })).not.toBeChecked();
    expect(set1().liberoReplaces).toEqual(['p6', 'p7']);

    // Untick #6, tick the setter.
    await fireEvent.press(middle6);
    await fireEvent.press(within(chooser).getByRole('checkbox', { name: /number 1 / }));
    expect(set1().liberoReplaces).toEqual(['p7', 'p1']);

    // #7 goes to the bench → no longer replaced.
    await fireEvent.press(screen.getByTestId('slot-player-6'));
    await fireEvent.press(screen.getByTestId('bench-drop'));
    expect(set1().slots[6]).toBeNull();
    expect(set1().liberoReplaces).toEqual(['p1']);

    // Suggest middles again → only #6 is a middle on court now.
    await fireEvent.press(
      screen.getByRole('button', { name: 'Suggest the middle blockers on court' }),
    );
    expect(set1().liberoReplaces).toEqual(['p6']);
  });
});
