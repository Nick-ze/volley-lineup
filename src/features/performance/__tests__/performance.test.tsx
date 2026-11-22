import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, Player, Position, SetEvent, SetLineup } from '@/domain/types';
import { useAppStore } from '@/store';
import { usePhotoStore } from '@/store/photoStore';

const player = (n: number, lastName: string, positions: Position[]): Player => ({
  id: `p${n}`,
  teamId: 'team1',
  firstName: 'A',
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
  player(8, 'Sub', ['OH']),
];

const set = (setNumber: 1 | 2, weServeFirst: boolean, events: SetEvent[]): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  // The libero takes the middles' back-row spots (#6 at the start).
  liberoReplaces: ['p3', 'p6'],
  weServeFirst,
  events,
});

/*
 * Set 1 (we serve; 3 : 3): #4 kill · #1 serve error · #2 kill (side-out) · #8 in for #5 ·
 * #8 attack error · won (side-out) · #4 block error on #3's serve (no libero: #3 serves).
 * Set 2 (they serve; 1 : 3): #2 reception error · #2 attack error · #2 attack error · won.
 */
const set1 = set(1, true, [
  { type: 'point', winner: 'us', kind: 'kill', playerId: 'p4' },
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'serve', playerId: 'p1' },
  { type: 'point', winner: 'us', kind: 'kill', playerId: 'p2' },
  { type: 'sub', outPlayerId: 'p5', inPlayerId: 'p8' },
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'attack', playerId: 'p8' },
  { type: 'point', winner: 'us' },
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'block', playerId: 'p4' },
]);
const set2 = set(2, false, [
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'reception', playerId: 'p2' },
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'attack', playerId: 'p2' },
  { type: 'point', winner: 'them', kind: 'ourError', errorType: 'attack', playerId: 'p2' },
  { type: 'point', winner: 'us' },
]);

function seed(sets: SetLineup[]) {
  const match: Match = {
    id: 'm1',
    teamId: 'team1',
    seasonId: 's1',
    opponentId: 'o1',
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
  usePhotoStore.setState({ photos: {}, hydrated: true });
}

const text = (testID: string) => screen.getByTestId(testID).props.children;
const order = () =>
  screen.getAllByTestId(/^perf-row-/).map((row) => row.props.testID.replace('perf-row-', ''));
const card = (id: string) => [
  text(`perf-record-${id}`),
  text(`perf-actions-${id}`),
  text(`perf-rating-${id}`),
];
const line = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel as string;
const open = (query: string) =>
  renderRouter('./app', { initialUrl: `/match/m1/performance${query}` });

describe('performance view', () => {
  beforeEach(() => seed([set1, set2]));

  it('shows every player of set 1 with literal numbers', async () => {
    await open('?set=1');
    expect(await screen.findByTestId('perf-set-1')).toBeSelected();
    // v6.2: best first — ▲ by net, ±, rallies; ● tie by number; ▼ #6 (net 0), #1, #8 (net −1).
    expect(order()).toEqual(['p2', 'p7', 'p5', 'p3', 'p4', 'p6', 'p1', 'p8']);
    expect(card('p1')).toEqual([
      '6 rallies · 3–3 (0)',
      'K 0 · A 0 · B 0 · E 1 · Net −1',
      '▼ Negative',
    ]);
    expect(card('p2')).toEqual([
      '6 rallies · 3–3 (0)',
      'K 1 · A 0 · B 0 · E 0 · Net +1',
      '▲ Positive',
    ]);
    expect(card('p3')).toEqual(['6 rallies · 3–3 (0)', 'K 0 · A 0 · B 0 · E 0 · Net 0', '● Even']);
    expect(card('p4')).toEqual(['6 rallies · 3–3 (0)', 'K 1 · A 0 · B 0 · E 1 · Net 0', '● Even']);
    // The libero played 5 rallies; #6 only the one where #3 served.
    expect(card('p7')).toEqual([
      '5 rallies · 3–2 (+1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▲ Positive',
    ]);
    expect(card('p5')).toEqual([
      '3 rallies · 2–1 (+1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▲ Positive',
    ]);
    expect(card('p8')).toEqual([
      '3 rallies · 1–2 (−1)',
      'K 0 · A 0 · B 0 · E 1 · Net −1',
      '▼ Negative',
    ]);
    expect(card('p6')).toEqual([
      '1 rally · 0–1 (−1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▼ Negative',
    ]);
    expect(screen.getByTestId('perf-legend')).toBeTruthy();
    expect(screen.getByTestId('perf-row-p1').props.accessibilityLabel).toBe(
      '#1 A Setter: 6 rallies, 3 won, 3 lost while on court, plus/minus 0, kills 0, aces 0, blocks 0, errors 1, net points −1, rating Negative. Show details',
    );
  });

  it('switches to set 2 and all sets', async () => {
    await open('?set=1');
    await fireEvent.press(await screen.findByTestId('perf-set-2'));
    // #8 didn't play set 2; #6 started but the libero covered every rally.
    // #2 (net −3) near the bottom, #6 without rallies last.
    expect(order()).toEqual(['p1', 'p3', 'p4', 'p5', 'p7', 'p2', 'p6']);
    expect(card('p2')).toEqual([
      '4 rallies · 1–3 (−2)',
      'K 0 · A 0 · B 0 · E 3 · Net −3',
      '▼ Negative',
    ]);
    expect(card('p6')).toEqual([
      '0 rallies · 0–0 (0)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '– No rallies',
    ]);

    await fireEvent.press(screen.getByTestId('perf-set-all'));
    expect(screen.getByTestId('perf-set-all')).toBeSelected();
    // Best first; #7 before #5 (same net and ±, more rallies); #2 (net −2) last.
    expect(order()).toEqual(['p4', 'p7', 'p5', 'p6', 'p3', 'p8', 'p1', 'p2']);
    expect(card('p2')).toEqual([
      '10 rallies · 4–6 (−2)',
      'K 1 · A 0 · B 0 · E 3 · Net −2',
      '▼ Negative',
    ]);
    expect(card('p7')).toEqual([
      '9 rallies · 4–5 (−1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▼ Negative',
    ]);
    expect(card('p5')).toEqual([
      '7 rallies · 3–4 (−1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▼ Negative',
    ]);
    expect(card('p6')).toEqual([
      '1 rally · 0–1 (−1)',
      'K 0 · A 0 · B 0 · E 0 · Net 0',
      '▼ Negative',
    ]);
  });

  it('shows a player detail for all sets, keeps the switcher and goes back', async () => {
    await open('?set=all');
    await fireEvent.press(await screen.findByTestId('perf-row-p2'));
    expect(text('perf-detail-name')).toBe('#2 A Outside');
    expect(line('perf-on-court')).toBe('On court: 10 of 10 rallies');
    expect(line('perf-won-lost')).toBe('Won – lost: 4 won, 6 lost (−2)');
    expect(line('perf-error-rate')).toBe('Error rate: 30% (3 errors in 10 rallies)');
    expect(line('perf-errors-per-action')).toBe('Errors per action: 75%');
    expect(line('perf-serve-error-rate')).toBe('Serve error rate: 0%');
    expect(line('perf-attack-error-rate')).toBe('Attack error rate: 67%');
    expect(line('perf-breakdown')).toBe('Errors by type: 1 reception error, 2 attack errors');
    expect(line('perf-kills')).toBe('Kills: 1');
    expect(line('perf-serves')).toBe('Serves: 1');
    expect(line('perf-serve-points')).toBe('Points on serve: 0');

    // The switcher stays: set 1 for the same player.
    await fireEvent.press(screen.getByTestId('perf-set-1'));
    expect(line('perf-on-court')).toBe('On court: 6 of 6 rallies');
    expect(line('perf-error-rate')).toBe('Error rate: 0% (0 errors in 6 rallies)');
    expect(line('perf-breakdown')).toBe('Errors by type: No errors');
    expect(line('perf-attack-error-rate')).toBe('Attack error rate: 0%');

    await fireEvent.press(
      screen.getByRole('button', { name: 'All players: back to the overview' }),
    );
    expect(screen.queryByTestId('perf-detail')).toBeNull();
    expect(screen.getByTestId('perf-set-1')).toBeSelected();
    expect(order()).toHaveLength(8);
  });

  it("switching to a set the player didn't play shows the overview and forgets the player", async () => {
    await open('?set=all&player=p8');
    expect(await screen.findByTestId('perf-detail')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('perf-set-2')); // #8 didn't play set 2
    expect(screen.queryByTestId('perf-detail')).toBeNull();
    await fireEvent.press(screen.getByTestId('perf-set-all'));
    expect(screen.queryByTestId('perf-detail')).toBeNull(); // no stale player=p8
  });

  it('shows "–" for rates without a divisor and the serve error rate of the server', async () => {
    await open('?set=1&player=p1');
    expect(await screen.findByTestId('perf-detail')).toBeTruthy();
    expect(line('perf-serve-error-rate')).toBe('Serve error rate: 50%');
    expect(line('perf-attack-error-rate')).toBe('Attack error rate: –');
    expect(line('perf-breakdown')).toBe('Errors by type: 1 serve error');
    expect(line('perf-serve-points')).toBe('Points on serve: 1');
  });

  it('falls back to all sets for an invalid set and to the overview for an unknown player', async () => {
    await open('?set=9&player=nobody');
    expect(await screen.findByTestId('perf-set-all')).toBeSelected();
    expect(screen.queryByTestId('perf-detail')).toBeNull();
    expect(text('perf-record-p2')).toBe('10 rallies · 4–6 (−2)');
  });

  it('opens a player as a new history entry: Back returns to the overview', async () => {
    await open('?set=1');
    await fireEvent.press(await screen.findByTestId('perf-row-p4'));
    expect(await screen.findByTestId('perf-detail')).toBeTruthy();
    await act(() => router.back());
    expect(await screen.findByTestId('perf-row-p4')).toBeTruthy();
    expect(screen.queryByTestId('perf-detail')).toBeNull();
    expect(screen.getByTestId('perf-set-1')).toBeSelected();
  });

  it('shows an empty state when no set has been played', async () => {
    seed([set(1, true, [])]);
    await open('');
    expect(await screen.findByTestId('perf-empty')).toBeTruthy();
  });

  it('opens from the match screen for the selected set, in German too', async () => {
    useAppStore.setState({ language: 'de' });
    await renderRouter('./app', { initialUrl: '/match/m1?set=2' });
    const link = await screen.findByTestId('open-performance');
    expect(link.props.accessibilityLabel).toMatch(/^Leistung/);
    await fireEvent.press(link);
    expect(await screen.findByTestId('perf-set-2')).toBeSelected();
    expect(text('perf-actions-p2')).toBe('Ang 0 · Ass 0 · Blo 0 · Feh 3 · Netto −3');
    await fireEvent.press(screen.getByTestId('perf-row-p2'));
    expect(line('perf-breakdown')).toBe('Fehler nach Art: 1 Annahmefehler, 2 Angriffsfehler');
    expect(line('perf-on-court')).toBe('Auf dem Feld: 4 von 4 Ballwechsel');
  });

  it('opens all sets from a set that has not been played', async () => {
    await renderRouter('./app', { initialUrl: '/match/m1?set=3' });
    await fireEvent.press(await screen.findByTestId('open-performance'));
    expect(await screen.findByTestId('perf-set-all')).toBeSelected();
  });
});
