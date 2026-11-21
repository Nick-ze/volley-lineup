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
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
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
    // v4: the rotation is named after the setter (#1 started at 1, now at 6).
    expect(screen.getByText('Rotation 6')).toBeTruthy();
    expect([1, 2, 3, 4, 5, 6].map(numberAt)).toEqual([2, 3, 4, 5, 6, 1]);
    expect(
      screen.getByLabelText(
        /^Position 1: Number 2, O Outside, Outside Hitter, plays Outside Hitter, serving$/,
      ),
    );

    await press('point-us'); // our serve: no rotation
    expect(score()).toBe('2:0');
    expect(screen.getByText('Rotation 6')).toBeTruthy();

    await press('point-them'); // serve goes to them
    expect(score()).toBe('2:1');
    expect(screen.getByText('Rivals serves')).toBeTruthy();
    // v3: every rally is stamped with the time it was recorded (match duration).
    const at = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);
    expect(storedEvents()).toEqual([
      { type: 'point', winner: 'us', at },
      { type: 'point', winner: 'us', at },
      { type: 'point', winner: 'them', at },
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
    // The would-be warning shows on the bench before the tap; #3 coming back is fine.
    const hidden = { includeHiddenElements: true };
    expect(screen.getByTestId('live-bench-warning-9', hidden)).toHaveTextContent(
      'breaks the re-entry rule',
    );
    expect(screen.queryByTestId('live-bench-warning-3', hidden)).toBeNull();
    expect(screen.getByTestId('live-bench-9').props.accessibilityHint).toBe(
      'Comes in for #8 Sub. Warning: breaks the re-entry rule',
    );
    await press('live-bench-9');
    expect(numberAt(3)).toBe(9);
    expect(screen.getByText('Subs used 2/6')).toBeTruthy();
    expect(
      screen.getByText(
        '#9 Spare for #8 Sub: a substitute may only be replaced by the player they came in for, and each pair may swap back only once.',
      ),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Undo substitution: #9 Spare for #8 Sub' }),
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

  it('switching sets drops a half-finished substitution', async () => {
    seed([set1, { ...set1, setNumber: 2 }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await screen.findByText('Rivals serves');
    await press('live-court-2');
    expect(screen.getByTestId('sub-prompt')).toBeTruthy();
    await press('set-tab-2');
    expect(screen.getByTestId('scoreboard').props.accessibilityLabel).toMatch(/^Set 2,/);
    expect(screen.queryByTestId('sub-prompt')).toBeNull();
    await press('set-tab-1');
    expect(screen.queryByTestId('sub-prompt')).toBeNull();
    await press('live-bench-8'); // not pickable: nothing is going out
    expect(useAppStore.getState().matches[0]?.sets[0]?.events).toEqual([]);
  });

  it('shows the libero in for a back-row middle; tapping them subs the real player', async () => {
    seed([{ ...set1, liberoReplaces: ['p3', 'p6'] }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await screen.findByText('Rivals serves');
    // p6 is at position 6 (back row): the libero #7 stands in, tagged "L for #6".
    expect(numberAt(6)).toBe(7);
    expect(
      screen.getByTestId('live-libero-tag-6', { includeHiddenElements: true }),
    ).toHaveTextContent('L for #6');
    expect(numberAt(3)).toBe(3); // p3 is in the front row: no swap
    await press('live-court-6');
    expect(screen.getByText('Now tap the bench player who comes in for #6 Block.')).toBeTruthy();
    await press('live-bench-9');
    expect(storedEvents()).toEqual([{ type: 'sub', outPlayerId: 'p6', inPlayerId: 'p9' }]);
    // v4.0 (#130): the substitute takes over the middle's role, so the libero replaces them too.
    expect(numberAt(6)).toBe(7);
    expect(
      screen.getByTestId('live-libero-tag-6', { includeHiddenElements: true }),
    ).toHaveTextContent('L for #9');
  });

  it('a played set locks the lineup builder; resetting live data unlocks it', async () => {
    seed([{ ...set1, events: [{ type: 'point', winner: 'us' }] }]);
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    expect(await screen.findByTestId('lineup-locked')).toHaveTextContent(
      'This set has been played — reset live data to edit.',
    );
    expect(screen.getByTestId('clear-lineup')).toBeDisabled();
    await press('slot-player-1'); // tap-to-select does nothing
    await press('slot-player-2');
    await press('serve-us');
    expect(useAppStore.getState().matches[0]?.sets[0]).toMatchObject({
      slots: set1.slots,
      weServeFirst: false,
    });

    await press('open-live');
    expect(await screen.findByText('We serve · #2')).toBeTruthy();
    await press('reset-live');
    await press('confirm');
    expect(score()).toBe('0:0');
    expect(storedEvents()).toEqual([]);
    expect(screen.getByTestId('reset-live')).toBeDisabled();
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
    // v3: a won set replaces the rally buttons with the set-won panel.
    expect(screen.getByTestId('set-won-title')).toHaveTextContent('Set won by us');
    expect(screen.queryByTestId('point-us')).toBeNull();
  });

  it('is opened from the match screen and needs a complete lineup', async () => {
    seed([set1, { ...set1, setNumber: 2, slots: { ...set1.slots, 6: null } }]);
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    // v3: the Live button opens the current set (set 1 here), not the tab being viewed.
    await fireEvent.press(await screen.findByTestId('open-live'));
    expect(await screen.findByText('Rivals serves')).toBeTruthy();
    await press('set-tab-2');
    expect(
      await screen.findByText('Put six players on court before starting live mode.'),
    ).toBeTruthy();
  });

  it('explains when the set or match does not exist', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=4' });
    expect(await screen.findByText(/This set has no lineup yet/)).toBeTruthy();
  });
});
