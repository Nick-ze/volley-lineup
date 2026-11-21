import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, Player, PointEvent, Position, SetLineup } from '@/domain/types';
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
  player(5, 'Wing', ['OH', 'OPP']),
  player(6, 'Block', ['MB']),
  player(7, 'Dig', ['L']),
  player(8, 'Sub', ['OH']),
];

/** The setter #1 starts at position 4; Wing #5 plays opposite (a secondary position). */
const set1: SetLineup = {
  roles: { p5: 'OPP' },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p4', 2: 'p5', 3: 'p6', 4: 'p1', 5: 'p2', 6: 'p3' },
  liberoId: 'p7',
  weServeFirst: false,
  liberoReplaces: ['p3', 'p6'],
  events: [],
};

function seed(sets: SetLineup[]) {
  const match: Match = {
    id: 'm1',
    teamId: 'team1',
    opponent: 'Rivals',
    date: '2026-11-20',
    home: true,
    sets,
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

const hidden = { includeHiddenElements: true };
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const rotationText = () => screen.getByTestId('rotation-text');
const roleAt = (position: number) => screen.getByTestId(`live-role-${position}`, hidden);
const stored = (n: number) =>
  useAppStore.getState().matches[0]?.sets.find((s) => s.setNumber === n);

describe('live mode — roles and the setter rotation (v4)', () => {
  it('names the rotation after the setter through side-outs and a sub for the setter', async () => {
    seed([set1]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText('Rivals serves')).toBeTruthy();
    expect(rotationText()).toHaveTextContent('Rotation 4');
    expect(roleAt(4)).toHaveTextContent('S');
    expect(roleAt(2)).toHaveTextContent('OPP');
    expect(screen.queryByTestId('live-role-2-off', hidden)).toBeNull(); // secondary position
    // The libero stands in for middle #3 at 6 and shows "L".
    expect(roleAt(6)).toHaveTextContent('L');
    expect(screen.getByLabelText(/^Position 4: .*Setter, plays Setter$/)).toBeTruthy();

    await press('point-us'); // side-out: the setter moves 4 → 3
    expect(rotationText()).toHaveTextContent('Rotation 3');
    expect(roleAt(3)).toHaveTextContent('S');

    // #8 (an outside) comes in for the setter: they take over the S role, marked "*".
    await press('sub-start');
    await press('live-court-3');
    await press('live-bench-8');
    expect(roleAt(3)).toHaveTextContent('S');
    expect(screen.getByTestId('live-role-3-off', hidden)).toBeTruthy();
    expect(
      screen.getByLabelText(/^Position 3: .*plays Setter, not one of their positions$/),
    ).toBeTruthy();
    expect(rotationText()).toHaveTextContent('Rotation 3');

    await press('point-them');
    await press('point-us'); // side-out: the substitute setter moves 3 → 2
    expect(rotationText()).toHaveTextContent('Rotation 2');
    expect(screen.getByTestId('scoreboard').props.accessibilityLabel).toMatch(/Rotation 2$/);
  });

  it('a switched-off libero never stands in on the live court', async () => {
    seed([{ ...set1, liberoActive: false }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await screen.findByText('Rivals serves');
    expect(screen.queryByTestId(/^live-libero-tag-/, hidden)).toBeNull();
    expect(roleAt(6)).toHaveTextContent('MB');
  });

  it('the next-set setup rotates the starting six before the set', async () => {
    const won: PointEvent[] = Array.from({ length: 25 }, () => ({ type: 'point', winner: 'us' }));
    seed([{ ...set1, events: won }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=2' });
    expect(await screen.findByTestId('set-setup')).toBeTruthy();
    expect(screen.getByTestId('setup-rotate-cw')).toBeDisabled(); // nobody on court yet

    await press('setup-copy');
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 4');
    await fireEvent.press(screen.getByRole('button', { name: /^Rotate ↻/ }));
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 3');
    await fireEvent.press(screen.getByRole('button', { name: /^Rotate ↺/ }));
    await fireEvent.press(screen.getByRole('button', { name: /^Rotate ↺/ }));
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 5');

    await press('setup-start');
    expect(stored(2)?.slots).toEqual({ 1: 'p3', 2: 'p4', 3: 'p5', 4: 'p6', 5: 'p1', 6: 'p2' });
    expect(stored(2)?.roles).toEqual({ p5: 'OPP' });
    expect(rotationText()).toHaveTextContent('Rotation 5');
  });
});
