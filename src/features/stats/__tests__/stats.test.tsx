import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, PointEvent, SetLineup } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { fullLineup, seedTeam } from '../../presets/__fixtures__/team';

const W = (extra: Partial<PointEvent> = {}): PointEvent => ({
  type: 'point',
  winner: 'us',
  ...extra,
});
const L = (): PointEvent => ({ type: 'point', winner: 'them' });

const set = (setNumber: SetLineup['setNumber'], over: Partial<SetLineup>): SetLineup => ({
  setNumber,
  ...fullLineup(),
  weServeFirst: false,
  events: [],
  ...over,
});

/*
 * Set 1 (they serve): L, W kill #2 (side-out → R2, #2 serves), W ace #2, L.
 * By hand: R1 won 1, lost 1, received 2, side-outs 1 → 50 %, no break point;
 * R2 won 1, lost 1, nothing received → "–", 1 break point. #2: 1 serve turn, 1 point on serve.
 * Set 2 (we serve): W, W → R1 won 2, 2 break points; #1 serves one turn, 2 points.
 */
const match: Match = {
  id: 'm1',
  teamId: 'team1',
  opponent: 'Rivals',
  date: '2026-11-01',
  home: true,
  sets: [
    set(1, {
      events: [L(), W({ kind: 'kill', playerId: 'p2' }), W({ kind: 'ace', playerId: 'p2' }), L()],
    }),
    set(2, { weServeFirst: true, events: [W(), W()] }),
  ],
};

function seedMatch() {
  seedTeam();
  useAppStore.setState({ matches: [match] });
}

const cell = (table: string, row: string, col: string) =>
  screen.getByTestId(`${table}-${row}-${col}`, { includeHiddenElements: true }).props.children;

describe('Stats tab', () => {
  it('shows an empty state before any match is played', async () => {
    seedTeam();
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByText(t.stats.empty)).toBeTruthy();
  });

  it('shows the season overview, rotation and player numbers of a played match', async () => {
    seedMatch();
    await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
    expect(await screen.findByTestId('stats-tab')).toBeTruthy();
    expect(screen.getByLabelText(t.stats.season.recordLabel(0, 0))).toBeTruthy();
    expect(screen.getByLabelText(t.stats.season.setsLabel(0, 0))).toBeTruthy();
    expect(screen.getByLabelText(t.stats.season.pointsLabel(4, 2))).toBeTruthy();
    expect(screen.getByText(t.stats.season.inProgress(1))).toBeTruthy();

    expect(
      ['won', 'lost', 'sideOut', 'breakPoints'].map((c) => cell('rotation-table', 'r1', c)),
    ).toEqual(['3', '1', '50%', '2']);
    expect(
      ['won', 'lost', 'sideOut', 'breakPoints'].map((c) => cell('rotation-table', 'r2', c)),
    ).toEqual(['1', '1', '–', '1']);
    const p2 = ['setsStarted', 'setsPlayed', 'subIn', 'serveTurns', 'servePoints', 'kills', 'aces'];
    expect(p2.map((c) => cell('player-table', 'p2', c))).toEqual([
      '2',
      '2',
      '0',
      '1',
      '1',
      '1',
      '1',
    ]);
    expect(cell('player-table', 'p1', 'servePoints')).toBe('2');
    // The libero stands in for p6 at position 6 from the first rally of both sets.
    expect(cell('player-table', 'p7', 'setsPlayed')).toBe('2');
    expect(screen.queryByTestId('player-table-p8')).toBeNull();
    // Abbreviations are explained in a legend and spoken in full.
    expect(
      screen.getByText(new RegExp(t.stats.legend('SO%', t.stats.rotations.sideOutLabel))),
    ).toBeTruthy();
    expect(screen.getByTestId('rotation-table-r1').props.accessibilityLabel).toContain(
      `${t.stats.rotations.sideOutLabel} 50%`,
    );
  });

  it('is in German too', async () => {
    seedMatch();
    useAppStore.getState().setLanguage('de');
    try {
      await renderRouter('./app', { initialUrl: '/team/team1?tab=stats' });
      expect(await screen.findByText(de.stats.season.heading)).toBeTruthy();
      expect(screen.getByText(de.stats.players.kills)).toBeTruthy();
      expect(cell('rotation-table', 'r1', 'sideOut')).toBe('50 %');
    } finally {
      useAppStore.getState().setLanguage('en');
    }
  });
});

describe('Match stats', () => {
  it('opens from the match screen and filters by set', async () => {
    seedMatch();
    await renderRouter('./app', { initialUrl: '/match/m1' });
    await fireEvent.press(await screen.findByTestId('open-stats'));
    expect(screen).toHavePathname('/match/m1/stats');
    expect(await screen.findByTestId('match-stats')).toBeTruthy();
    expect(screen.getByTestId('match-stats-heading').props.children).toBe(
      t.stats.matchTitle('Rivals'),
    );

    const won = () => cell('rotation-table', 'r1', 'won');
    expect(screen.getByLabelText(t.stats.filter.allLabel)).toBeSelected();
    expect(won()).toBe('3');
    expect(screen.getByTestId('match-stats-points').props.children).toBe('Points 4 : 2');
    expect(screen.queryByTestId('stats-set-3')).toBeNull();

    await fireEvent.press(screen.getByTestId('stats-set-1'));
    expect(screen.getByLabelText(t.stats.filter.setLabel(1))).toBeSelected();
    expect(won()).toBe('1');
    expect(cell('rotation-table', 'r1', 'sideOut')).toBe('50%');
    expect(screen.getByTestId('match-stats-points').props.children).toBe('Points 2 : 2');

    await fireEvent.press(screen.getByTestId('stats-set-2'));
    expect(won()).toBe('2');
    expect(cell('rotation-table', 'r1', 'sideOut')).toBe('–');
    expect(screen.queryByTestId('player-table-p2')).not.toBeNull();
    expect(cell('player-table', 'p2', 'kills')).toBe('0');

    await fireEvent.press(screen.getByTestId('stats-set-all'));
    expect(won()).toBe('3');
  });

  it('says when the match has no rallies yet', async () => {
    seedTeam();
    useAppStore.setState({ matches: [{ ...match, sets: [set(1, {})] }] });
    await renderRouter('./app', { initialUrl: '/match/m1/stats' });
    expect(await screen.findByText(t.stats.matchEmpty)).toBeTruthy();
  });

  it('handles a match that does not exist', async () => {
    seedTeam();
    await renderRouter('./app', { initialUrl: '/match/nope/stats' });
    expect(await screen.findByText(t.stats.matchNotFound)).toBeTruthy();
  });
});
