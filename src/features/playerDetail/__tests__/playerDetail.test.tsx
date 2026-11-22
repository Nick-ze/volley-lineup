import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { ErrorType, Match, Player, PointEvent, PointKind, SetLineup } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

const player = (n: number, teamId = 't1'): Player => ({
  id: `p${n}`,
  teamId,
  firstName: `First${n}`,
  lastName: `Last${n}`,
  number: n,
  positions: [n === 7 ? 'L' : n === 3 || n === 6 ? 'MB' : 'OH'],
  active: n !== 9,
});

function point(winner: 'us' | 'them', kind?: PointKind, playerId?: string, type?: ErrorType) {
  const e: PointEvent = { type: 'point', winner };
  if (kind !== undefined) e.kind = kind;
  if (playerId !== undefined) e.playerId = playerId;
  if (type !== undefined) e.errorType = type;
  return e;
}
const W = (kind?: PointKind, id?: string) => point('us', kind, id);
const L = (kind?: PointKind, id?: string, type?: ErrorType) => point('them', kind, id, type);

const lineup = (over: Partial<SetLineup>): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  liberoReplaces: ['p3', 'p6'],
  weServeFirst: true,
  events: [],
  ...over,
});

/*
 * The scripted set of `src/domain/performance.test.ts` (worked out by hand there): 9 rallies,
 * a substitution p5 → p8 after rally 3, the libero p7 swapping in for the middles in the back
 * row. In it the libero p7 is on court for 7 rallies (won 3, lost 4) with 1 reception error;
 * the substitute p8 for 6 rallies (won 2, lost 4), subbed in once.
 */
const set1 = lineup({
  events: [
    W('ace', 'p1'),
    L('ourError', 'p2', 'attack'),
    W('kill', 'p4'),
    { type: 'sub', outPlayerId: 'p5', inPlayerId: 'p8' },
    L('ourError', 'p2', 'serve'),
    L('ourError', 'p7', 'reception'),
    W(),
    W('block', 'p4'),
    L(),
    L('ourError', undefined, 'netFault'),
  ],
});
/* Libero switched off; they serve: L (block error p6), W. 2 rallies, p7 / p8 not on court. */
const set2 = lineup({
  setNumber: 2,
  liberoActive: false,
  weServeFirst: false,
  events: [L('ourError', 'p6', 'block'), W()],
});

const match = (id: string, date: string, sets: SetLineup[]): Match => ({
  id,
  teamId: 't1',
  seasonId: 's1',
  opponentId: 'o1',
  opponent: `Opp ${id}`,
  date,
  home: true,
  sets,
});

/*
 * Season: m1 (2026-11-01) = set 1 + set 2 → 11 rallies; m2 (2026-11-08) = set 1 again → 9.
 * Libero p7: 7 + 7 = 14 of 20 rallies, won 6 lost 8 → −2, 2 reception errors, 2 sets started.
 * Substitute p8: 6 + 6 = 12 of 20, won 4 lost 8 → −4, subbed in twice, 0 sets started.
 */
function seed() {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [
      { id: 't1', profileId: 'prof', name: 'Herren 1', createdAt: '' },
      { id: 't2', profileId: 'prof', name: 'Damen 2', createdAt: '' },
    ],
    players: [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => player(n)), player(20, 't2')],
    matches: [match('m1', '2026-11-01', [set1, set2]), match('m2', '2026-11-08', [set1])],
    currentProfileId: 'prof',
  });
}

const value = (id: string) => screen.getByTestId(`season-${id}-value`).props.children;

beforeEach(seed);

describe('Player detail', () => {
  it('a roster tap opens the detail; the libero’s season with swaps, in literal numbers', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1' });
    await fireEvent.press(screen.getByTestId('player-7'));
    expect(screen).toHavePathname('/team/t1/players/p7');

    expect(within(screen.getByTestId('player-header')).getByText('First7 Last7')).toBeTruthy();
    expect(screen.getByTestId('player-number-circle')).toBeTruthy();
    expect(
      screen.getByLabelText(t.playerDetail.headerLabel(7, 'First7 Last7', 'Libero', 'Active')),
    ).toBeTruthy();

    expect(value('rallies')).toBe('14 of 20');
    expect(screen.getByLabelText(t.playerDetail.season.ralliesLabel(14, 20))).toBeTruthy();
    expect(value('plusMinus')).toBe('−2');
    expect(
      ['setsStarted', 'setsPlayed', 'subIn', 'subOut', 'serveTurns', 'serves', 'servePoints'].map(
        value,
      ),
    ).toEqual(['2', '2', '0', '0', '0', '0', '0']);
    expect(['kills', 'aces', 'blocks', 'errors'].map(value)).toEqual(['0', '0', '0', '2']);
    expect(
      within(screen.getByTestId('season-error-breakdown')).getByText('2 × reception error'),
    ).toBeTruthy();

    // Per match, newest first.
    const rows = within(screen.getByTestId('player-matches')).getAllByRole('button');
    expect(rows.map((r) => r.props.testID)).toEqual(['player-match-m2', 'player-match-m1']);
    expect(screen.getByTestId('player-match-m1-numbers').props.children).toBe(
      '1 set · 7/11 rallies · −1 · K 0 · A 0 · B 0 · E 1',
    );
    expect(screen.getByTestId('player-match-m2-numbers').props.children).toBe(
      '1 set · 7/9 rallies · −1 · K 0 · A 0 · B 0 · E 1',
    );
    await fireEvent.press(screen.getByTestId('player-match-m1'));
    expect(screen).toHavePathname('/match/m1/performance');
    expect(screen).toHaveSearchParams({ matchId: 'm1', set: 'all', player: 'p7' });
  });

  it('v7.0: each match line names its season', async () => {
    useAppStore.setState({
      seasons: [{ id: 's1', teamId: 't1', name: '2026/27', kind: 'season', createdAt: '' }],
    });
    await renderRouter('./app', { initialUrl: '/team/t1/players/p7' });
    expect(await screen.findByTestId('player-match-m1-head')).toHaveTextContent(
      /^01\.11\.26 · 2026\/27 · /,
    );
  });

  it('a substitute: subs in, sets played but not started', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p8' });
    expect(await screen.findByTestId('player-detail')).toBeTruthy();
    expect(value('rallies')).toBe('12 of 20');
    expect(value('plusMinus')).toBe('−4');
    expect(['setsStarted', 'setsPlayed', 'subIn', 'subOut'].map(value)).toEqual([
      '0',
      '2',
      '2',
      '0',
    ]);
    expect(within(screen.getByTestId('season-error-breakdown')).getByText('–')).toBeTruthy();
  });

  it('a starter: serves, points, kills / blocks and the subbed-out count', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    // p4: on court in every rally (11 + 9 = 20), 2 kills, 2 blocks (one each per set 1).
    expect(await screen.findByTestId('season-rallies-value')).toBeTruthy();
    expect(value('rallies')).toBe('20 of 20');
    expect(['kills', 'aces', 'blocks', 'errors'].map(value)).toEqual(['2', '0', '2', '0']);
  });

  it('Edit opens the existing player form', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    await fireEvent.press(
      await screen.findByRole('button', { name: t.playerDetail.editLabel('First4 Last4') }),
    );
    expect(screen).toHavePathname('/team/t1/player');
    expect(screen).toHaveSearchParams({ teamId: 't1', playerId: 'p4' });
    expect(await screen.findByLabelText(t.roster.player.firstName)).toBeTruthy();
  });

  it('shows an empty state (and the injured status) for a player who hasn’t played', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p9' });
    expect(await screen.findByText(t.playerDetail.season.empty)).toBeTruthy();
    expect(screen.getByText('Injured')).toBeTruthy();
    expect(screen.queryByTestId('season-stats')).toBeNull();
    expect(screen.queryByTestId('player-matches')).toBeNull();
  });

  it('goes to the roster when the player is deleted while the screen is open', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p9' });
    expect(await screen.findByTestId('player-detail')).toBeTruthy();
    await act(async () => useAppStore.getState().deletePlayer('p9'));
    expect(screen).toHavePathname('/team/t1');
    expect(screen.queryByText(t.roster.player.notFound)).toBeNull();
  });

  it('a player of another team is not found', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1/players/p20' });
    expect(await screen.findByText(t.roster.player.notFound)).toBeTruthy();
    expect(screen.queryByTestId('player-detail')).toBeNull();
  });

  it('German', async () => {
    useAppStore.setState({ language: 'de' });
    await renderRouter('./app', { initialUrl: '/team/t1/players/p7' });
    expect(await screen.findByText(de.playerDetail.season.heading)).toBeTruthy();
    expect(value('rallies')).toBe('14 von 20');
    expect(screen.getByText('2 × Annahmefehler')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: de.playerDetail.description.showLabel }),
    ).toBeTruthy();
  });
});
