import { fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, Player, Position, SetLineup } from '@/domain/types';
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
  player(8, 'Sub', ['OH']),
  player(9, 'Spare', ['MB']),
];

const set1: SetLineup = {
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: false,
  liberoReplaces: [],
  events: [],
};

function seed(sets: SetLineup[] = [set1]) {
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

const score = () =>
  `${screen.getByTestId('score-us').props.children}:${screen.getByTestId('score-them').props.children}`;
const numberAt = (position: number) =>
  within(screen.getByTestId(`live-court-${position}`)).getByText(/^\d+$/).props.children;
const storedEvents = () => useAppStore.getState().matches[0]?.sets[0]?.events;
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

describe('live match mode', () => {
  beforeEach(() => seed());

  it('scores rallies with side-outs, shows the server and undoes', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText('Rivals serves')).toBeTruthy();
    expect(score()).toBe('0:0');
    expect(screen.getByText('Rotation 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nothing to undo' })).toBeDisabled();

    await press('point-us'); // side-out: rotate, #2 serves
    expect(score()).toBe('1:0');
    expect(screen.getByText('We serve · #2')).toBeTruthy();
    expect(screen.getByText('Rotation 2')).toBeTruthy();
    expect([1, 2, 3, 4, 5, 6].map(numberAt)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(screen.getByLabelText(/^Position 1: Number 2, O Outside, Outside Hitter, serving$/));

    await press('point-us'); // our serve: no rotation
    expect(score()).toBe('2:0');
    expect(screen.getByText('Rotation 2')).toBeTruthy();

    await press('point-them'); // serve goes to them
    expect(score()).toBe('2:1');
    expect(screen.getByText('Rivals serves')).toBeTruthy();
    expect(storedEvents()).toEqual([
      { type: 'point', winner: 'us' },
      { type: 'point', winner: 'us' },
      { type: 'point', winner: 'them' },
    ]);

    await fireEvent.press(screen.getByRole('button', { name: 'Undo last point for them' }));
    expect(score()).toBe('2:0');
    expect(screen.getByText('We serve · #2')).toBeTruthy();
    expect(storedEvents()).toHaveLength(2);
  });

  it('substitutes a court player for a bench player, counts subs and warns on re-entry', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await screen.findByText('Rivals serves');
    expect(screen.getByText('Subs used 0/6')).toBeTruthy();

    await press('sub-start');
    expect(screen.getByText('Tap the player on court who goes out.')).toBeTruthy();
    await press('live-court-3'); // #3 goes out
    expect(screen.getByText('Now tap the bench player who comes in for #3 Middle.')).toBeTruthy();
    await press('live-bench-8');
    expect(numberAt(3)).toBe(8);
    expect(screen.getByText('Subs used 1/6')).toBeTruthy();
    expect(screen.queryByTestId('live-bench-8')).toBeNull();
    expect(screen.getByTestId('live-bench-3')).toBeTruthy(); // #3 now on the bench
    expect(screen.queryByTestId('live-bench-7')).toBeNull(); // the libero is never a sub
    expect(storedEvents()).toEqual([{ type: 'sub', outPlayerId: 'p3', inPlayerId: 'p8' }]);

    // #8 may only be replaced by #3: bringing #9 in breaks the re-entry rule (a warning).
    await press('live-court-3');
    await press('live-bench-9');
    expect(numberAt(3)).toBe(9);
    expect(screen.getByText('Subs used 2/6')).toBeTruthy();
    expect(
      screen.getByText(
        '#9 Spare for #8 Sub: a player may only come back for the player who replaced them.',
      ),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Undo substitution #8 Sub for #9 Spare' }),
    );
    expect(numberAt(3)).toBe(8);
    expect(screen.queryByTestId('warnings-banner')).toBeNull();
    expect(screen.getByText('Subs used 1/6')).toBeTruthy();

    // Cancelling the flow changes nothing.
    await press('live-court-1');
    await press('sub-cancel');
    expect(screen.queryByTestId('sub-prompt')).toBeNull();
    expect(storedEvents()).toHaveLength(1);
  });

  it('shows set point and set won', async () => {
    const events = [
      ...Array.from({ length: 24 }, () => ({ type: 'point' as const, winner: 'us' as const })),
      ...Array.from({ length: 20 }, () => ({ type: 'point' as const, winner: 'them' as const })),
    ];
    seed([{ ...set1, events }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText('Set point for us!')).toBeTruthy();
    await press('point-us');
    expect(screen.getByText('We won the set. End it whenever you like.')).toBeTruthy();
  });

  it('is opened from the match screen and needs a complete lineup', async () => {
    seed([set1, { ...set1, setNumber: 2, slots: { ...set1.slots, 6: null } }]);
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    await fireEvent.press(await screen.findByTestId('open-live'));
    expect(
      await screen.findByText('Put six players on court before starting live mode.'),
    ).toBeTruthy();
    await press('set-tab-1');
    expect(await screen.findByText('Rivals serves')).toBeTruthy();
  });

  it('explains when the set or match does not exist', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=4' });
    expect(await screen.findByText(/This set has no lineup yet/)).toBeTruthy();
  });
});
