import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Match, Player, Position, SetLineup } from '@/domain/types';
import { de } from '@/i18n/de';
import { usePhotoStore } from '@/store/photoStore';
import { useAppStore } from '@/store';

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
const players = [
  player(1, 'Setter', ['S']),
  player(2, 'Outside', ['OH']),
  player(3, 'Middle', ['MB']),
  player(4, 'Oppo', ['OPP']),
  player(5, 'Wing', ['OH']),
  player(6, 'Block', ['MB']),
];

/*
 * They serve first. e0 W kill #2 (side-out: #2 rotates to 1 and serves), e1 L our error
 * (attack) #2, e2 W (side-out). #2 is on court for all 3 rallies: 2 won, 1 lost.
 */
const set1: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: null,
  weServeFirst: false,
  liberoReplaces: [],
  events: [
    { type: 'point', winner: 'us', kind: 'kill', playerId: 'p2' },
    { type: 'point', winner: 'them', kind: 'ourError', playerId: 'p2', errorType: 'attack' },
    { type: 'point', winner: 'us' },
  ],
};

function seed(sets: SetLineup[], language: 'en' | 'de' = 'en') {
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
    language,
    profiles: [{ id: 'prof1', name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
    teams: [{ id: 'team1', profileId: 'prof1', name: 'Herren 1', createdAt: '2026-01-01' }],
    players,
    matches: [match],
    currentProfileId: 'prof1',
  });
  usePhotoStore.setState({ photos: {}, hydrated: true });
}

afterEach(() => useAppStore.setState({ language: 'en' }));

describe('live mode: Performance view (header button)', () => {
  it('shows every player, opens a player and switches back to the court', async () => {
    seed([set1]);
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    expect(await screen.findByText('Point us')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('live-view-performance'));
    expect(screen.queryByText('Point us')).toBeNull();
    expect(screen.getByTestId('perf-set-1')).toBeSelected();
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) {
      expect(screen.getByTestId(`perf-row-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('perf-record-p2')).toHaveTextContent('3 rallies · 2–1 (+1)');

    await fireEvent.press(screen.getByTestId('perf-row-p2'));
    expect(screen.getByTestId('perf-detail')).toBeTruthy();
    expect(screen.getByTestId('perf-breakdown').props.accessibilityLabel).toBe(
      'Errors by type: 1 attack error',
    );
    expect(screen).toHavePathname('/match/m1/live'); // no navigation away from live mode

    await fireEvent.press(screen.getByTestId('live-view-live'));
    expect(screen.getByText('Point us')).toBeTruthy();
    expect(screen.queryByTestId('perf-detail')).toBeNull();
  });

  it('shows the empty state before the first rally, in German too', async () => {
    seed([{ ...set1, events: [] }], 'de');
    await renderRouter('./app', { initialUrl: '/match/m1/live?set=1' });
    await fireEvent.press(
      await screen.findByRole('button', { name: de.live.viewTabs.performanceLabel }),
    );
    expect(screen.getByTestId('perf-empty')).toHaveTextContent(de.performance.empty);
  });
});
