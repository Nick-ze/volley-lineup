import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Player, Position, SetEvent, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';
import { type SeedMatch, seedApp } from '@/test-utils';

const player = (n: number, lastName: string, positions: Position[]): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  // v8: names are shown first name first, so the distinct word is the first name.
  firstName: lastName,
  lastName: lastName.slice(0, 1),
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
  player(8, 'Sub', ['OH']),
];

const set1 = (
  events: SetEvent[] = [],
  weServeFirst = false,
  setNumber: SetLineup['setNumber'] = 1,
): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst,
  liberoReplaces: [],
  events,
});

function seed(...sets: SetLineup[]) {
  const match: SeedMatch = {
    id: 'm1',
    opponent: 'Rivals',
    date: '2026-11-20',
    home: true,
    sets: sets.length ? sets : [set1()],
  };
  seedApp({ players, matches: [match] });
}

const events = (index = 0) => useAppStore.getState().matches[0]?.sets[index]?.events ?? [];
/** The last stored event without its timestamp. */
const lastTag = (index = 0) => {
  const list = events(index);
  const { at: _at, ...rest } = list[list.length - 1] as SetEvent & { at?: string };
  return rest;
};
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const row = () => screen.queryByTestId('point-tag-row');
const open = (set = 1) => renderRouter('./app', { initialUrl: `/match/m1/live?set=${set}` });

describe('point tagging in live mode', () => {
  beforeEach(() => seed());

  it('is hidden until a rally is recorded', async () => {
    await open();
    await screen.findByTestId('point-us');
    expect(row()).toBeNull();
  });

  it('tags a kill with a player and names it in the undo label', async () => {
    await open();
    await press('point-us');
    expect(within(row()!).getByText('Opp. error')).toBeTruthy();
    expect(screen.queryByTestId('tag-ourError')).toBeNull();

    await press('tag-kill');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us', kind: 'kill' });
    // The player picker: the six on court by number, no bench player, no libero (not swapped).
    const chips = within(row()!)
      .getAllByText(/^#\d/)
      .map((c) => c.props.children);
    expect(chips).toEqual([
      '#1 Setter',
      '#2 Outside',
      '#3 Middle',
      '#4 Oppo',
      '#5 Wing',
      '#6 Center',
    ]);

    await press('tag-player-p4');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us', kind: 'kill', playerId: 'p4' });
    expect(
      screen.getByRole('button', { name: 'Undo last point for us · kill #4 Oppo' }),
    ).toBeTruthy();

    // Another player replaces the choice; tapping the chosen one again removes them.
    await press('tag-player-p2');
    expect(lastTag()).toMatchObject({ kind: 'kill', playerId: 'p2' });
    await press('tag-player-p2');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us', kind: 'kill' });
  });

  it('skips with one tap and leaves the point untagged', async () => {
    await open();
    await press('point-us');
    expect(screen.getByRole('button', { name: 'Skip point details' })).toBeTruthy();
    await press('tag-close');
    expect(row()).toBeNull();
    expect(lastTag()).toEqual({ type: 'point', winner: 'us' });
  });

  it('the next rally dismisses the row of the previous one', async () => {
    await open();
    await press('point-us');
    await press('point-them');
    expect(screen.queryByTestId('tag-kill')).toBeNull();
    expect(screen.getByTestId('tag-ourError')).toBeTruthy();
    expect(events().map((e) => e.type === 'point' && e.kind)).toEqual([undefined, undefined]);
  });

  it('a substitution dismisses the row', async () => {
    await open();
    await press('point-them');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Substitution: bring a player on from the bench' }),
    );
    await press('live-court-2');
    await fireEvent.press(screen.getByLabelText(/^Number 8, Sub S/));
    expect(events()[1]).toEqual({ type: 'sub', outPlayerId: 'p2', inPlayerId: 'p8' });
    expect(row()).toBeNull();
  });

  it('tags our error with a player and their ace without one', async () => {
    await open();
    await press('point-them');
    await press('tag-ourError');
    await press('tag-player-p5');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them', kind: 'ourError', playerId: 'p5' });

    await press('point-them');
    await press('tag-opponentAce');
    expect(lastTag()).toEqual({ type: 'point', winner: 'them', kind: 'opponentAce' });
    expect(screen.queryByTestId('tag-player-p1')).toBeNull();
    expect(screen.getByTestId('tag-opponentAce')).toBeTruthy();
  });

  it('clears a tag by tapping the chosen chip again', async () => {
    await open();
    await press('point-us');
    await press('tag-opponentError');
    expect(lastTag()).toMatchObject({ kind: 'opponentError' });
    await press('tag-opponentError');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us' });

    // From the player picker: the chosen kind chip clears the tag and shows the kinds again.
    await press('tag-block');
    await press('tag-player-p3');
    await press('tag-block');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us' });
    expect(screen.getByTestId('tag-kill')).toBeTruthy();
  });

  it('offers an ace only to the side that served the rally', async () => {
    await open();
    await press('point-us'); // they served: no ace for us
    expect(screen.getByTestId('tag-kill')).toBeTruthy();
    expect(screen.queryByTestId('tag-ace')).toBeNull();
    await press('point-them'); // we served: no ace for them
    expect(screen.getByTestId('tag-opponentKill')).toBeTruthy();
    expect(screen.queryByTestId('tag-opponentAce')).toBeNull();
  });

  it('tags the match-winning rally under the match summary', async () => {
    const us = (n: number): SetEvent[] =>
      Array.from({ length: n }, () => ({ type: 'point', winner: 'us' }));
    seed(set1(us(25), true, 1), set1(us(25), true, 2), set1(us(24), true, 3));
    await open(3);
    await press('point-us');
    expect(screen.getByTestId('match-summary')).toBeTruthy();
    await press('tag-kill');
    await press('tag-player-p5');
    expect(lastTag(2)).toEqual({ type: 'point', winner: 'us', kind: 'kill', playerId: 'p5' });
    expect(
      screen.getByRole('button', { name: 'Undo last point for us · kill #5 Wing' }),
    ).toBeTruthy();
  });

  it('suggests our server for an ace', async () => {
    await open();
    await press('point-us'); // side-out: #2 serves
    await press('point-us');
    await press('tag-ace');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us', kind: 'ace', playerId: 'p2' });
    expect(screen.getByTestId('tag-player-p2')).toHaveProp('aria-pressed', true);
  });

  it('undo removes the tagged rally and closes the row', async () => {
    await open();
    await press('point-us');
    await press('point-us');
    await press('tag-kill');
    await press('tag-player-p1');
    await press('undo');
    expect(events()).toHaveLength(1);
    expect(lastTag()).toEqual({ type: 'point', winner: 'us' });
    expect(row()).toBeNull();
  });

  it('tags the winning rally of a set under the "set won" panel', async () => {
    const won24: SetEvent[] = Array.from({ length: 24 }, () => ({ type: 'point', winner: 'us' }));
    seed(set1(won24, true));
    await open();
    await press('point-us');
    expect(screen.getByTestId('set-won-panel')).toBeTruthy();
    await press('tag-block');
    await press('tag-player-p3');
    expect(lastTag()).toEqual({ type: 'point', winner: 'us', kind: 'block', playerId: 'p3' });
    expect(
      screen.getByRole('button', { name: 'Undo last point for us · block #3 Middle' }),
    ).toBeTruthy();
  });

  it('a tagged rally shows up in the match stats player table', async () => {
    await open();
    await press('point-us');
    await press('tag-kill');
    await press('tag-player-p4');
    await press('point-them');
    await press('tag-ourError');
    await press('tag-player-p4');

    await renderRouter('./app', { initialUrl: '/match/m1/stats' });
    const line = await screen.findByTestId('player-table-p4');
    expect(line.props.accessibilityLabel).toMatch(/kills 1,/);
    expect(line.props.accessibilityLabel).toMatch(/errors 1$/);
    expect(screen.getByTestId('player-table-p2').props.accessibilityLabel).toMatch(/kills 0,/);
  });
});
