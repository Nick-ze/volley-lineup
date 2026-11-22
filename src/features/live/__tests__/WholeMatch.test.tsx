import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type {
  LineupPreset,
  Match,
  Player,
  PointEvent,
  SetLineup,
  SetNumber,
  Side,
} from '@/domain/types';
import { useAppStore } from '@/store';

const player = (n: number, lastName: string, active = true): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  // v8: names are shown first name first, so the distinct word is the first name.
  firstName: lastName,
  lastName: lastName.slice(0, 1),
  number: n,
  positions: ['OH'],
  active,
});

const players: Player[] = [
  player(1, 'Setter'),
  player(2, 'Outside'),
  player(3, 'Middle'),
  player(4, 'Oppo'),
  player(5, 'Wing'),
  player(6, 'Block'),
  player(7, 'Dig'),
  player(8, 'Sub'),
];

const slots = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' } as const;

const starters: LineupPreset = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  id: 'st',
  teamId: 'team1',
  name: '',
  kind: 'starters',
  slots: { ...slots, 6: 'p8' },
  liberoId: 'p7',
  liberoReplaces: [],
  createdAt: '2026-01-01',
};

const points = (winner: Side, n: number, at?: (i: number) => string): PointEvent[] =>
  Array.from({ length: n }, (_, i) =>
    at ? { type: 'point', winner, at: at(i) } : { type: 'point', winner },
  );

const set = (setNumber: SetNumber, us: number, them: number, weServeFirst = true): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber,
  slots: { ...slots },
  liberoId: 'p7',
  weServeFirst,
  liberoReplaces: [],
  events: [...points('us', us), ...points('them', them)],
});

function seed(sets: SetLineup[], extra: Partial<Match>[] = [], playerList = players) {
  const match = (over: Partial<Match>): Match => ({
    id: 'm1',
    teamId: 'team1',
    seasonId: 's1',
    opponentId: 'o1',
    opponent: 'Rivals',
    date: '2026-11-20',
    home: true,
    sets,
    ...over,
  });
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof1', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
    teams: [{ id: 'team1', profileId: 'prof1', name: 'Herren 1', createdAt: '2026-01-01' }],
    players: playerList,
    matches: [match({}), ...extra.map(match)],
    presets: [starters, { ...starters, id: 'pr1', kind: 'preset', name: 'Big block' }],
    currentProfileId: 'prof1',
  });
}

const stored = (n: SetNumber) =>
  useAppStore.getState().matches[0]?.sets.find((s) => s.setNumber === n);
const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));
const score = () =>
  `${screen.getByTestId('score-us').props.children}:${screen.getByTestId('score-them').props.children}`;

/** Puts a started set near its end in the store (keeps the test fast). */
async function fastForward(n: SetNumber, us: number, them: number) {
  const s = stored(n) as SetLineup;
  await act(async () => {
    useAppStore.getState().setLineup('m1', {
      ...s,
      events: [...points('us', us), ...points('them', them)],
    });
  });
}

/** From the set-won panel: Start set N → setup → fill → Start. */
async function startNextSet(fill: 'setup-starters' | 'setup-copy') {
  await press('next-set');
  expect(screen.getByTestId('set-setup')).toBeTruthy();
  expect(screen.getByTestId('setup-start')).toBeDisabled();
  await press(fill);
  expect(screen.getByTestId('setup-filled')).toHaveTextContent(/^6\/6 on court/);
  await press('setup-start');
  expect(screen.queryByTestId('set-setup')).toBeNull();
  expect(score()).toBe('0:0');
}

describe('whole-match live mode', () => {
  it('plays a 5-set match from set 1 to the summary without leaving live mode', async () => {
    seed([set(1, 24, 20)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    // Opening without ?set goes to the current set.
    expect(await screen.findByTestId('set-score')).toHaveTextContent('Sets 0:0');
    expect(screen.getByTestId('scoreboard').props.accessibilityLabel).toMatch(/^Set 1,/);

    // Set 1: 25:20 for us → set-won panel instead of the rally buttons.
    await press('point-us');
    expect(screen.getByTestId('set-won-title')).toHaveTextContent('Set won by us');
    expect(screen.getByTestId('set-won-panel')).toHaveTextContent(/25:20/);
    expect(screen.queryByTestId('point-us')).toBeNull();
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 1:0');

    // Set 2 via team starters; we served first in set 1, so Rivals serve first now.
    await press('next-set');
    expect(screen.getByTestId('serve-them')).toBeChecked();
    await press('setup-starters');
    await press('setup-start');
    expect(stored(2)).toMatchObject({ weServeFirst: false, slots: { 6: 'p8' }, events: [] });
    expect(screen.getByText('Rivals serves')).toBeTruthy();
    await fastForward(2, 20, 24);
    await press('point-them');
    expect(screen.getByTestId('set-won-title')).toHaveTextContent('Set won by Rivals');
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 1:1');

    // Set 3: a deuce set, 28:26.
    await startNextSet('setup-copy');
    expect(stored(3)).toMatchObject({ weServeFirst: true, slots: { 6: 'p8' } });
    await fastForward(3, 24, 24);
    for (const side of ['us', 'them', 'us', 'them'] as const) await press(`point-${side}`);
    expect(score()).toBe('26:26');
    expect(screen.queryByTestId('set-won-panel')).toBeNull();
    await press('point-us');
    expect(screen.getByText('Set point for us!')).toBeTruthy();
    await press('point-us');
    expect(screen.getByTestId('set-won-panel')).toHaveTextContent(/28:26/);
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 2:1');

    // Set 4: lost 20:25.
    await startNextSet('setup-starters');
    await fastForward(4, 20, 24);
    await press('point-them');
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 2:2');

    // Set 5: the tiebreak to 15; we choose to serve first.
    await press('next-set');
    await press('setup-copy');
    await press('serve-us');
    await press('setup-start');
    expect(stored(5)).toMatchObject({ weServeFirst: true });
    await fastForward(5, 14, 12);
    expect(screen.getByText('Set point for us!')).toBeTruthy();
    await press('point-us');

    expect(screen.getByTestId('match-summary')).toBeTruthy();
    expect(screen.getByTestId('summary-result')).toHaveTextContent('Won 3:2');
    const setScores = ([1, 2, 3, 4, 5] as const).map(
      (n) => screen.getByTestId(`summary-set-${n}`).props.accessibilityLabel,
    );
    expect(setScores).toEqual([
      'Set 1: us 25, Rivals 20',
      'Set 2: us 20, Rivals 25',
      'Set 3: us 28, Rivals 26',
      'Set 4: us 20, Rivals 25',
      'Set 5: us 15, Rivals 12',
    ]);
    expect(useAppStore.getState().matches[0]?.sets).toHaveLength(5);
  });

  it('ends a 3:0 match after set 3 and opens the summary from the match screen', async () => {
    seed([set(1, 25, 10), set(2, 25, 23), set(3, 24, 10)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=3' });
    await press('point-us');
    expect(await screen.findByTestId('summary-result')).toHaveTextContent('Won 3:0');
    expect(screen.queryByTestId('summary-set-4')).toBeNull();
    expect(screen.queryByTestId('next-set')).toBeNull();
    expect(screen.queryByTestId('summary-duration')).toBeNull(); // only one stamped rally

    await press('summary-back');
    expect(await screen.findByTestId('match-result')).toHaveTextContent('3:0 won');
    await press('open-live'); // the match is over → the summary
    expect(await screen.findByTestId('match-summary')).toBeTruthy();
    // Browsing an earlier set: it shows as won, links on, and can't be undone (later sets played).
    await press('set-tab-1');
    expect(await screen.findByTestId('set-won-panel')).toBeTruthy();
    expect(screen.getByTestId('next-set')).toHaveTextContent('Go to set 2');
    expect(screen.queryByTestId('undo')).toBeNull();
  });

  it('shows the duration from the rally timestamps', async () => {
    const stamp = (min: number) => () => new Date(Date.UTC(2026, 10, 20, 18, min)).toISOString();
    seed([
      { ...set(1, 0, 0), events: [...points('us', 24, stamp(0)), ...points('us', 1, stamp(20))] },
      { ...set(2, 0, 0), events: points('them', 25, stamp(50)) },
      { ...set(3, 0, 0), events: points('us', 25, stamp(70)) },
      { ...set(4, 0, 0), events: points('us', 25, stamp(92)) },
    ]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    expect(await screen.findByTestId('summary-result')).toHaveTextContent('Won 3:1');
    expect(screen.getByTestId('summary-duration')).toHaveTextContent('1 h 32 min');
  });

  it('undo re-opens a won set, also from the next set and from the summary', async () => {
    seed([set(1, 24, 20)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await screen.findByTestId('scoreboard');
    await press('point-us');
    await press('undo'); // the set-won panel's undo
    expect(score()).toBe('24:20');
    expect(screen.getByTestId('point-us')).toBeTruthy();
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 0:0');

    // In the setup of set 2: Undo goes back to set 1 and re-opens it.
    await press('point-us');
    await press('next-set');
    expect(screen.getByTestId('set-setup')).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Undo the last point of set 1 (re-opens it)' }),
    );
    expect(await screen.findByTestId('point-us')).toBeTruthy();
    expect(screen.getByTestId('scoreboard').props.accessibilityLabel).toMatch(/^Set 1,/);
    expect(score()).toBe('24:20');

    // Set 2 started but no rally yet: Undo still goes back across the set end.
    await press('point-us');
    await startNextSet('setup-starters');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Undo the last point of set 1 (re-opens it)' }),
    );
    expect(await screen.findByTestId('point-us')).toBeTruthy();
    expect(score()).toBe('24:20');
    expect(stored(2)?.events).toEqual([]); // the untouched set 2 may stay stored
  });

  it('undo in the summary re-opens the deciding set', async () => {
    // Set 3 ends with our winning point (their 10 points come first).
    const set3 = { ...set(3, 0, 0), events: [...points('them', 10), ...points('us', 25)] };
    seed([set(1, 25, 10), set(2, 25, 10), set3]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    expect(await screen.findByTestId('match-summary')).toBeTruthy();
    await press('undo');
    expect(score()).toBe('24:10');
    expect(screen.getByTestId('set-score')).toHaveTextContent('Sets 2:0');
  });

  it('setup skips injured players, offers presets and links to the lineup builder', async () => {
    const injured = players.map((p) => (p.id === 'p8' ? { ...p, active: false } : p));
    seed([set(1, 25, 20)], [], injured);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    expect(await screen.findByTestId('set-setup')).toBeTruthy();
    await press('setup-preset-Big block');
    expect(screen.getByTestId('setup-skipped')).toHaveTextContent(/#8 Sub/);
    expect(screen.getByTestId('setup-filled')).toHaveTextContent(/^5\/6 on court/);
    expect(screen.getByTestId('setup-start')).toBeDisabled();
    await press('setup-edit');
    expect(await screen.findByTestId('open-live')).toBeTruthy();
    expect(stored(2)).toMatchObject({ slots: { 6: null }, weServeFirst: false, events: [] });
  });

  it('a complete, unplayed set offers the serve choice before the first rally', async () => {
    seed([set(1, 0, 0)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    await press('serve-them');
    expect(stored(1)?.weServeFirst).toBe(false);
    expect(screen.getByText('Rivals serves')).toBeTruthy();
    await press('point-us');
    expect(screen.queryByTestId('serve-them')).toBeNull();
  });

  it('shows results in the match list and the match header', async () => {
    seed(
      [set(1, 25, 10), set(2, 10, 25), set(3, 25, 10), set(4, 25, 10)],
      [
        {
          id: 'm2',
          opponent: 'Lions',
          sets: [set(1, 1, 25), set(2, 25, 1), set(3, 1, 25), set(4, 1, 25)],
        },
        { id: 'm3', opponent: 'Bears', sets: [set(1, 25, 1), set(2, 25, 1), set(3, 3, 1)] },
        { id: 'm4', opponent: 'Owls', sets: [set(1, 0, 0)] },
        { id: 'm5', opponent: 'Hawks', sets: [set(1, 3, 0)] },
      ],
    );
    // v7: the match list is on the season screen (the seeded matches are in season s1).
    useAppStore.setState({
      seasons: [
        { id: 's1', teamId: 'team1', name: '2026', kind: 'season', createdAt: '2026-01-01' },
      ],
    });
    await renderRouter('./app', { initialUrl: '/team/team1/season/s1' });
    // The result has its own (never truncated) line under date · home/away.
    const results = (await screen.findAllByTestId('match-row-result')).map((r) => r.props.children);
    expect(results.sort()).toEqual(['1:3 lost', '2:0 · in progress', '3:1 won', 'in progress']);
    expect(screen.getAllByText('20.11.26 · Home')).toHaveLength(5);
    // Screen readers hear the result too.
    expect(
      screen.getByLabelText('vs Lions, 20.11.26: open the match. Result: 1:3 lost'),
    ).toBeTruthy();
    expect(screen.getByLabelText('vs Owls, 20.11.26: open the match')).toBeTruthy();
  });

  it('shows the result line in the match header', async () => {
    seed([set(1, 25, 1), set(2, 3, 1)]);
    await renderRouter('./app', { initialUrl: '/match/m1?set=1' });
    expect(await screen.findByTestId('match-result')).toHaveTextContent('1:0 · in progress');
  });

  it('a prepared next set gets the rotating serve default when reached from the previous set', async () => {
    seed([set(1, 24, 20), set(2, 0, 0)]); // set 2 built in advance, "we serve first"
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    await screen.findByTestId('scoreboard');
    await press('point-us');
    await press('next-set');
    expect(stored(2)?.weServeFirst).toBe(false); // we served first in set 1
    expect(screen.getByTestId('serve-them')).toBeChecked();
    expect(screen.getByText('Rivals serves')).toBeTruthy();
  });

  it('an incomplete stored next set starts its serve choice from the default', async () => {
    seed([set(1, 25, 20), { ...set(2, 0, 0), slots: { ...slots, 6: null } }]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    expect(await screen.findByTestId('set-setup')).toBeTruthy();
    expect(screen.getByTestId('serve-them')).toBeChecked();
    await press('serve-us'); // a choice made here wins
    await press('setup-starters');
    await press('setup-start');
    expect(stored(2)).toMatchObject({ weServeFirst: true, slots: { 6: 'p8' } });
  });

  it('"Edit lineup" with nobody on court only opens the builder', async () => {
    seed([set(1, 25, 20)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    await press('setup-edit');
    expect(await screen.findByTestId('open-live')).toBeTruthy();
    expect(stored(2)).toBeUndefined();
  });

  it('a set stored after the deciding set is read-only', async () => {
    seed([set(1, 25, 1), set(2, 25, 1), set(3, 25, 1), set(4, 3, 0)]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=4' });
    expect(
      await screen.findByText('Played after the match was decided — not counted.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('point-us')).toBeNull();
  });

  it('hides a duration under one minute', async () => {
    const at = (i: number) => new Date(Date.UTC(2026, 10, 20, 18, 0, i)).toISOString();
    seed([1, 2, 3].map((n) => ({ ...set(n as SetNumber, 0, 0), events: points('us', 25, at) })));
    await renderRouter('./app', { initialUrl: '/match/m1/live' });
    expect(await screen.findByTestId('match-summary')).toBeTruthy();
    expect(screen.queryByTestId('summary-duration')).toBeNull();
  });
});
