import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import type { Player } from '@/domain/types';
import { useAppStore } from '@/store';

const player = (n: number, first: string, last: string, active = true): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: first,
  lastName: last,
  number: n,
  positions: ['OH'],
  active,
});

const players = [
  player(1, 'Anna', 'Alpha'),
  player(2, 'Bea', 'Beta'),
  player(3, 'Cleo', 'Gamma'),
  player(4, 'Dora', 'Delta', false),
];

function seed() {
  const set1 = emptySetLineup(1);
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 'team1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players,
    matches: [
      {
        id: 'm1',
        teamId: 'team1',
        opponent: 'Rivals',
        date: '2026-11-20',
        home: true,
        sets: [{ ...set1, slots: { ...set1.slots, 1: 'p1', 2: 'p2' } }],
      },
    ],
    currentProfileId: 'prof',
  });
}

const sets = () => useAppStore.getState().matches[0].sets;

describe('lineup builder (tap-to-select)', () => {
  beforeEach(() => {
    useAppStore.getState().resetAll();
    seed();
  });

  it('places a bench player on a slot, then moves them without duplicating', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    const bench = await screen.findByTestId('bench');
    // Only active players appear on the bench.
    expect(within(bench).getByTestId('bench-player-1')).toBeTruthy();
    expect(within(bench).queryByTestId('bench-player-4')).toBeNull();

    await fireEvent.press(within(bench).getByTestId('bench-player-3'));
    expect(screen.getByText(/Selected: 3 Cleo Gamma/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('slot-empty-4'));

    expect(within(screen.getByTestId('court-slot-4')).getByTestId('slot-player-4')).toBeTruthy();
    expect(within(screen.getByTestId('bench')).queryByTestId('bench-player-3')).toBeNull();
    expect(sets().find((s) => s.setNumber === 2)?.slots[4]).toBe('p3');

    // Move the same player to another slot: moved, not duplicated.
    await fireEvent.press(screen.getByTestId('slot-player-4'));
    await fireEvent.press(screen.getByTestId('slot-empty-6'));
    const set2 = sets().find((s) => s.setNumber === 2)!;
    expect(set2.slots[6]).toBe('p3');
    expect(set2.slots[4]).toBeNull();
    expect(Object.values(set2.slots).filter((id) => id === 'p3')).toHaveLength(1);

    // Tap the selected player again → deselect; then move them back to the bench.
    await fireEvent.press(screen.getByTestId('slot-player-6'));
    await fireEvent.press(screen.getByTestId('slot-player-6'));
    expect(screen.queryByTestId('bench-drop')).toBeNull();
    await fireEvent.press(screen.getByTestId('slot-player-6'));
    await fireEvent.press(screen.getByTestId('bench-drop'));
    expect(within(screen.getByTestId('bench')).getByTestId('bench-player-3')).toBeTruthy();
  });

  it('sets a libero, taking them off the court', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    await fireEvent.press(await screen.findByTestId('slot-player-1'));
    await fireEvent.press(screen.getByTestId('libero-empty'));
    const set1 = sets()[0];
    expect(set1.liberoId).toBe('p1');
    expect(set1.slots[1]).toBeNull();
    expect(screen.getByTestId('libero-player')).toBeTruthy();
  });

  it('copies the lineup from the previous set and toggles who serves', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    expect((await screen.findByTestId('copy-previous')).props.accessibilityState?.disabled).toBe(
      true,
    );

    await fireEvent.press(screen.getByTestId('set-tab-2'));
    expect(sets()).toHaveLength(1); // browsing a tab does not create the set
    await fireEvent.press(await screen.findByTestId('copy-previous'));
    const set2 = sets().find((s) => s.setNumber === 2)!;
    expect(set2.slots[1]).toBe('p1');
    expect(set2.slots[2]).toBe('p2');
    expect(screen.getByTestId('slot-player-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('serve-them'));
    expect(sets().find((s) => s.setNumber === 2)?.weServeFirst).toBe(false);
    expect(sets()[0].weServeFirst).toBe(true);
    await fireEvent.press(screen.getByTestId('serve-us'));
    expect(sets().find((s) => s.setNumber === 2)?.weServeFirst).toBe(true);

    await fireEvent.press(screen.getByTestId('clear-lineup'));
    expect(sets().find((s) => s.setNumber === 2)?.slots[1]).toBeNull();
  });
  it('copies from the nearest earlier saved set when the one before was never saved', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=3' });
    await fireEvent.press(await screen.findByTestId('copy-previous'));
    const set3 = sets().find((s) => s.setNumber === 3)!;
    expect([set3.slots[1], set3.slots[2]]).toEqual(['p1', 'p2']);
  });

  it('does not save an unsaved set for no-op actions', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    await fireEvent.press(await screen.findByTestId('serve-us')); // already active
    await fireEvent.press(screen.getByTestId('clear-lineup')); // already empty
    expect(sets()).toHaveLength(1);
  });
});

describe('lineup builder validation panel', () => {
  beforeEach(() => {
    useAppStore.getState().resetAll();
    seed();
  });

  it('shows errors and warnings from validateLineup', async () => {
    const validation = jest.requireActual('@/domain/lineupValidation');
    const spy = jest.spyOn(validation, 'validateLineup').mockReturnValue({
      valid: false,
      errors: [{ code: 'INCOMPLETE' }, { code: 'DUPLICATE_PLAYER', positions: [1, 2] }],
      warnings: [{ code: 'NO_SETTER' }],
    });
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    expect(await screen.findByText('✕ Fewer than 6 players on court.')).toBeTruthy();
    expect(
      screen.getByText('✕ A player is in more than one position. (Positions 1, 2)'),
    ).toBeTruthy();
    expect(screen.getByText('! No setter in the starting six.')).toBeTruthy();
    spy.mockRestore();
  });

  it('shows the ok state when there are no issues', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    expect(await screen.findByText('Lineup is complete.')).toBeTruthy();
  });
});
