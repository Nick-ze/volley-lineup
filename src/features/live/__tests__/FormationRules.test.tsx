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
  player(5, 'Wing', ['OH']),
  player(6, 'Block', ['MB']),
  player(7, 'Dig', ['L']),
];

/** S 1 · OH 2 · MB 3 · OPP 4 · OH 5 · MB 6; the libero #7 replaces the middles; we serve. */
const set1: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: true,
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

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const stored = (n: number) =>
  useAppStore.getState().matches[0]?.sets.find((s) => s.setNumber === n);
/** The player chips offered by the tag row, in display order. */
const offered = () =>
  screen
    .queryAllByTestId(/^tag-player-/)
    .map((chip) => String(chip.props.testID).replace('tag-player-', ''));

describe('live next-set setup — formation (v5)', () => {
  const won: PointEvent[] = Array.from({ length: 25 }, () => ({ type: 'point', winner: 'us' }));

  it('switches system and order next to the rotate buttons and stores them on Start', async () => {
    seed([{ ...set1, formation: { ...set1.formation, setterAt: 4 }, events: won }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=2' });
    expect(await screen.findByTestId('setup-formation')).toBeTruthy();
    // An empty draft already has a formation: the setter spot names the rotation.
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 1');
    expect(screen.getByRole('radio', { name: '5-1 system' })).toBeChecked();

    await press('setup-copy');
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 4');
    await fireEvent.press(screen.getByRole('radio', { name: '6-2 system' }));
    expect(screen.getByRole('radio', { name: '6-2 system' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '5-1 system' })).not.toBeChecked();
    // 6-2 with setter spots 4 and 1: the back-row one (1) names the rotation.
    expect(screen.getByTestId('setup-setter-at')).toHaveTextContent('Setter on 1');
    await fireEvent.press(screen.getByRole('radio', { name: /^Setter → middle/ }));
    expect(screen.getByRole('radio', { name: /^Setter → middle/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: /^Rotate ↻/ }));

    await press('setup-start');
    expect(stored(2)?.formation).toEqual({ system: '6-2', order: 'middle', setterAt: 3 });
  });

  it('shows the German labels', async () => {
    seed([{ ...set1, events: won }]);
    useAppStore.setState({ language: 'de' });
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=2' });
    expect(await screen.findByRole('radio', { name: '6-2-System' })).toBeTruthy();
    expect(screen.getByText('Zuspieler → Mitte')).toBeTruthy();
    expect(screen.getByText('Reihenfolge nach dem Zuspieler')).toBeTruthy();
  });
});

describe('point tags — only plausible players (rules check #35)', () => {
  beforeEach(() => seed([set1]));
  const open = () => renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });

  it('block: front-row players only; ace: our server; kill: anyone but the libero', async () => {
    await open();
    await press('point-us'); // we served (#1), the libero #7 stands in for #6 at 6
    await press('tag-block');
    expect(offered()).toEqual(['p2', 'p3', 'p4']);
    await press('tag-block'); // clear the kind

    await press('tag-ace');
    expect(offered()).toEqual(['p1']);
    await press('tag-ace');

    await press('tag-kill');
    expect(offered()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('our error can be anyone on court, the libero included', async () => {
    await open();
    await press('point-them');
    await press('tag-ourError');
    expect(offered()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p7']);
  });
});
