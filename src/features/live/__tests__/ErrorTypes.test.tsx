import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, Player, Position, SetEvent, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';

const player = (n: number, lastName: string, positions: Position[]): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: lastName.slice(0, 1),
  lastName,
  number: n,
  positions,
  active: true,
});

const players: Player[] = [
  player(1, 'Setter', ['S']),
  player(2, 'Outside', ['OH']),
  player(3, 'Middle', ['MB']),
  player(4, 'Oppo', ['OPP']),
  player(5, 'Wing', ['OH']),
  player(6, 'Center', ['MB']),
  player(7, 'Dig', ['L']),
];

function seed(weServeFirst: boolean, events: SetEvent[] = []) {
  const set: SetLineup = {
    formation: { system: '5-1', order: 'outside', setterAt: 1 },
    liberoActive: true,
    setNumber: 1,
    slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
    liberoId: 'p7',
    weServeFirst,
    liberoReplaces: [],
    events,
  };
  const match: Match = {
    id: 'm1',
    teamId: 'team1',
    opponent: 'Rivals',
    date: '2026-11-20',
    home: true,
    sets: [set],
  };
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof1', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
    teams: [{ id: 'team1', profileId: 'prof1', name: 'Herren 1', createdAt: '2026-01-01' }],
    players,
    matches: [match],
    currentProfileId: 'prof1',
  });
}

const events = () => useAppStore.getState().matches[0]?.sets[0]?.events ?? [];
const lastTag = () => {
  const list = events();
  const { at: _at, ...rest } = list[list.length - 1] as SetEvent & { at?: string };
  return rest;
};
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const row = () => screen.queryByTestId('point-tag-row');
const open = () => renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
const playerChips = () =>
  within(row()!)
    .getAllByText(/^#\d/)
    .map((c) => c.props.children);

describe('error types on "our error" in live mode', () => {
  it('tags our error with a type and a player and names both in the undo label', async () => {
    seed(false); // they serve: a reception error is possible, a serve error isn't
    await open();
    await press('point-them');
    await press('tag-ourError');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them', kind: 'ourError' });
    expect(screen.queryByTestId('tag-error-serve')).toBeNull();
    for (const type of ['reception', 'attack', 'block', 'set', 'netFault', 'other']) {
      expect(screen.getByTestId(`tag-error-${type}`)).toBeTruthy();
    }
    expect(
      screen.getByRole('button', { name: 'Net / foul: error type of our error' }),
    ).toBeTruthy();

    await press('tag-error-block');
    expect(lastTag()).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'block',
    });
    // Only the chosen type stays; a block error is made by the front row (2, 3, 4).
    expect(screen.queryByTestId('tag-error-attack')).toBeNull();
    expect(playerChips()).toEqual(['#2 Outside', '#3 Middle', '#4 Oppo']);

    await press('tag-player-p4');
    expect(lastTag()).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'block',
      playerId: 'p4',
    });
    expect(
      screen.getByRole('button', { name: 'Undo last point for them · our error (block) #4 Oppo' }),
    ).toBeTruthy();
  });

  it('saves a type without a player, and a player without a type', async () => {
    seed(false);
    await open();
    await press('point-them');
    await press('tag-ourError');
    await press('tag-error-reception');
    await press('tag-close');
    expect(row()).toBeNull();
    expect(lastTag()).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'reception',
    });
    expect(
      screen.getByRole('button', { name: 'Undo last point for them · our error (reception)' }),
    ).toBeTruthy();

    await press('point-them');
    await press('tag-ourError');
    // Without a type, everyone on court can be picked.
    expect(playerChips()).toHaveLength(6);
    await press('tag-player-p6');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them', kind: 'ourError', playerId: 'p6' });
  });

  it('is never required: ✕ or the next rally skip it', async () => {
    seed(false);
    await open();
    await press('point-them');
    await press('tag-ourError');
    await press('point-us');
    expect(events()[0]).toEqual(expect.objectContaining({ kind: 'ourError' }));
    expect(events()[0]).not.toHaveProperty('errorType');
    expect(screen.queryByTestId('tag-error-attack')).toBeNull();

    await press('point-them');
    await press('tag-close');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them' });
  });

  it('clears the type by tapping it again and offers the types again', async () => {
    seed(false);
    await open();
    await press('point-them');
    await press('tag-ourError');
    await press('tag-error-attack');
    await press('tag-player-p2');
    expect(screen.getByRole('button', { name: 'Attack: remove the error type' })).toBeTruthy();
    await press('tag-error-attack');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them', kind: 'ourError', playerId: 'p2' });
    expect(screen.getByTestId('tag-error-set')).toBeTruthy();

    // The kind chip clears the whole tag, type included.
    await press('tag-error-set');
    await press('tag-ourError');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them' });
    expect(screen.getByTestId('tag-opponentKill')).toBeTruthy();
  });

  it('offers a serve error only on our serve and preselects our server', async () => {
    seed(true); // we serve: #1 is the server, no reception error
    await open();
    await press('point-them');
    await press('tag-ourError');
    expect(screen.queryByTestId('tag-error-reception')).toBeNull();
    await press('tag-error-serve');
    expect(lastTag()).toEqual({
      type: 'point',
      winner: 'them',
      kind: 'ourError',
      errorType: 'serve',
      playerId: 'p1',
    });
    expect(playerChips()).toEqual(['#1 Setter']);
    expect(screen.getByTestId('tag-player-p1')).toHaveProp('aria-pressed', true);
    expect(
      screen.getByRole('button', {
        name: 'Undo last point for them · our error (serve) #1 Setter',
      }),
    ).toBeTruthy();
  });

  it('keeps old untyped tags valid', async () => {
    seed(false, [{ type: 'point', winner: 'them', kind: 'ourError', playerId: 'p3' }]);
    await open();
    expect(
      await screen.findByRole('button', { name: 'Undo last point for them · our error #3 Middle' }),
    ).toBeTruthy();
  });
});
