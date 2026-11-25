/**
 * v10: a view-only member (player role of a shared team) sees the team side read-only with the
 * reason; managers of a shared team and local teams keep every control (design §7.3, E2).
 */
import { act, fireEvent, screen } from '@testing-library/react-native';

import { seasonTabPage } from '@/domain/tour';
import type { TeamRole } from '@/domain/types';
import { resetTourSession, useTourSession } from '@/features/tour/tourSession';
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
  resetTourSession();
  if (access === 'local') return;
  setRole(access === 'viewer' ? 'player' : 'manager');
}

function setRole(role: TeamRole) {
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

  it('the season screen sets no tour page (its tips point at missing controls)', async () => {
    await renderApp(`/team/team1/season/${seasonId()}?tab=matches`);
    expect(useTourSession.getState().focused).toBeNull();
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

describe('the role changes to view-only while a form is open', () => {
  beforeEach(() => seed('manager'));

  it('closes the team edit form without saving', async () => {
    await renderApp('/teams');
    await fireEvent.press(screen.getByRole('button', { name: t.roster.teams.rename('Herren 1') }));
    await fireEvent.changeText(screen.getByLabelText(t.roster.teams.name), 'Renamed');
    await act(async () => setRole('player'));
    expect(screen.queryByLabelText(t.roster.teams.name)).toBeNull();
    expect(button(t.common.save)).toBeNull();
    expect(useAppStore.getState().teams[0]!.name).toBe('Herren 1');
    // Back to manager: the form stays closed.
    await act(async () => setRole('manager'));
    expect(screen.queryByLabelText(t.roster.teams.name)).toBeNull();
  });

  it('closes the opponent rename without saving', async () => {
    await renderApp(`/team/team1/season/${seasonId()}?tab=opponents`);
    await fireEvent.press(
      screen.getByRole('button', { name: t.seasons.opponents.renameLabel(opponentName) }),
    );
    const field = screen.getByLabelText(t.seasons.opponents.newName(opponentName));
    await fireEvent.changeText(field, 'Tigers');
    await act(async () => setRole('player'));
    expect(screen.queryByLabelText(t.seasons.opponents.newName(opponentName))).toBeNull();
    expect(useAppStore.getState().opponents.map((o) => o.name)).toContain(opponentName);
    await act(async () => setRole('manager'));
    expect(screen.queryByLabelText(t.seasons.opponents.newName(opponentName))).toBeNull();
  });

  it('the season screen sets its tour page for managers', async () => {
    await renderApp(`/team/team1/season/${seasonId()}?tab=matches`);
    expect(useTourSession.getState().focused).toBe(seasonTabPage('matches'));
  });
});
