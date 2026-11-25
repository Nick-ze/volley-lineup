/**
 * v10: a view-only member (player role of a shared team) sees the team side read-only with the
 * reason; managers of a shared team and local teams keep every control (design §7.3, E2).
 */
import { screen } from '@testing-library/react-native';

import type { TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';
import { makePlayer, makeSet, renderApp, seedApp } from '@/test-utils';

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => jest.restoreAllMocks());

const players = [makePlayer(1, 'Sina', ['S']), makePlayer(2, 'Olga', ['OH'])];
const match = { id: 'm1', opponent: 'Lions', date: '2026-11-20', home: true, sets: [makeSet()] };

type Access = 'viewer' | 'manager' | 'local';

function seed(access: Access) {
  seedApp({ players, matches: [match] });
  if (access === 'local') return;
  const role: TeamRole = access === 'viewer' ? 'player' : 'manager';
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'prof1' },
      teams: { team1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

const button = (name: string) => screen.queryByRole('button', { name });
const note = () => screen.queryByText(t.sync.readOnly.viewer);
const seasonId = () => useAppStore.getState().seasons[0]!.id;
const opponentName = 'Lions';

describe('view-only member', () => {
  beforeEach(() => seed('viewer'));

  it('roster: no Add player, no active switch, the reason is shown', async () => {
    await renderApp('/team/team1?tab=roster');
    expect(note()).toBeTruthy();
    expect(button(t.roster.roster.addPlayer)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByTestId('player-1-status')).toHaveTextContent(t.roster.roster.active);
    // Opening a player still works.
    expect(screen.getByTestId('player-1')).toBeTruthy();
  });

  it('player detail: no Edit and no description, the reason is shown', async () => {
    await renderApp('/team/team1/players/p1');
    expect(note()).toBeTruthy();
    expect(screen.queryByTestId('player-edit')).toBeNull();
    expect(screen.queryByTestId('description-section')).toBeNull();
    expect(screen.getByTestId('player-header')).toBeTruthy();
  });

  it.each([
    ['player editor', '/team/team1/player?playerId=p1'],
    ['new player', '/team/team1/player'],
    ['new season', '/team/team1/season-new'],
    ['season editor', '/team/team1/season-new?seasonId=s1'],
    ['new match', '/team/team1/match-new?seasonId=s1'],
  ])('%s: the reason instead of the form', async (_name, url) => {
    await renderApp(url);
    expect(screen.getByTestId('view-only-screen')).toBeTruthy();
    expect(note()).toBeTruthy();
    expect(button(t.common.save)).toBeNull();
    expect(button(t.roster.player.delete)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('seasons tab: no New season', async () => {
    await renderApp('/team/team1?tab=matches');
    expect(note()).toBeTruthy();
    expect(button(t.seasons.list.newSeason)).toBeNull();
    expect(screen.getByTestId('season-list')).toBeTruthy();
  });

  it('season: no Edit, New match or Delete match; the match still opens', async () => {
    await renderApp(`/team/team1/season/${seasonId()}?tab=matches`);
    expect(note()).toBeTruthy();
    expect(button(t.seasons.screen.editLabel('2026'))).toBeNull();
    expect(button(t.roster.matches.newMatch)).toBeNull();
    expect(button(t.roster.matches.delete(opponentName))).toBeNull();
    expect(screen.getByText(t.roster.matches.vs(opponentName))).toBeTruthy();
  });

  it('opponents: no Add, Rename or Delete', async () => {
    await renderApp(`/team/team1/season/${seasonId()}?tab=opponents`);
    expect(screen.queryByTestId('opponent-name')).toBeNull();
    expect(button(t.seasons.opponents.addLabel)).toBeNull();
    expect(button(t.seasons.opponents.renameLabel(opponentName))).toBeNull();
    expect(screen.getByTestId('opponent-list')).toBeTruthy();
  });
});

describe.each<Access>(['manager', 'local'])('%s: unchanged', (access) => {
  beforeEach(() => seed(access));

  it('roster keeps Add player and the active switches, no note', async () => {
    await renderApp('/team/team1?tab=roster');
    expect(note()).toBeNull();
    expect(button(t.roster.roster.addPlayer)).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(2);
  });

  it('player detail keeps Edit and the description', async () => {
    await renderApp('/team/team1/players/p1');
    expect(note()).toBeNull();
    expect(screen.getByTestId('player-edit')).toBeTruthy();
    expect(screen.getByTestId('description-section')).toBeTruthy();
  });

  it('the editors show their forms', async () => {
    await renderApp('/team/team1/player?playerId=p1');
    expect(screen.queryByTestId('view-only-screen')).toBeNull();
    expect(button(t.common.save)).toBeTruthy();
  });

  it('seasons keep New season, Edit, New match, Delete and the opponent controls', async () => {
    await renderApp('/team/team1?tab=matches');
    expect(button(t.seasons.list.newSeason)).toBeTruthy();
    await renderApp(`/team/team1/season/${seasonId()}?tab=matches`);
    expect(note()).toBeNull();
    expect(button(t.seasons.screen.editLabel('2026'))).toBeTruthy();
    expect(button(t.roster.matches.newMatch)).toBeTruthy();
    expect(button(t.roster.matches.delete(opponentName))).toBeTruthy();
    await renderApp(`/team/team1/season/${seasonId()}?tab=opponents`);
    expect(button(t.seasons.opponents.renameLabel(opponentName))).toBeTruthy();
    expect(screen.getByTestId('opponent-name')).toBeTruthy();
  });
});
