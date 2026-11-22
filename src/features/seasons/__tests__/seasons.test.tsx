import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { emptySetLineup } from '@/domain/lineup';
import { findOpponentByName } from '@/domain/seasons';
import type { PointEvent, SetLineup, SetNumber } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore } from '@/store';

import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';

const s = t.seasons;
const store = () => useAppStore.getState();

beforeEach(async () => {
  store().resetAll();
  useAppStore.setState({ hydrated: true });
  resetStartupRedirect();
  await AsyncStorage.clear();
});

async function type(label: string, text: string) {
  await fireEvent.changeText(screen.getByLabelText(label), text);
}

async function press(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
}

function seedTeam() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  return store().addTeam({ profileId: profile.id, name: 'Herren 1' });
}

const points = (winner: 'us' | 'them', n: number): PointEvent[] =>
  Array.from({ length: n }, () => ({ type: 'point', winner }));

/** A set with this many rallies won by each side. */
const played = (n: SetNumber, us: number, them: number): SetLineup => ({
  ...emptySetLineup(n),
  events: [...points('us', us), ...points('them', them)],
});

/** Adds a match against `opponent` (created in the season if new) with the given set scores. */
function addMatch(
  teamId: string,
  seasonId: string,
  opponent: string,
  date: string,
  scores: [number, number][] = [],
) {
  const opp =
    findOpponentByName(store().opponents, seasonId, opponent) ??
    store().addOpponent(seasonId, opponent);
  return store().addMatch({
    teamId,
    seasonId,
    opponentId: opp.id,
    opponent: opp.name,
    date,
    home: true,
    sets:
      scores.length === 0
        ? [emptySetLineup(1)]
        : scores.map(([us, them], i) => played((i + 1) as SetNumber, us, them)),
  });
}

/** Season A: vs Lions won 3:0, lost 1:3, one in progress, one upcoming; Bears without matches. */
function seedSeasonA(teamId: string) {
  const season = store().addSeason({
    teamId,
    name: '2025/26',
    kind: 'season',
    startDate: '2025-09-01',
    endDate: '2026-04-30',
    location: 'Munich',
  });
  addMatch(teamId, season.id, 'Lions', '2025-10-01', [
    [25, 10],
    [25, 10],
    [25, 10],
  ]);
  addMatch(teamId, season.id, 'Lions', '2025-11-01', [
    [25, 20],
    [20, 25],
    [20, 25],
    [20, 25],
  ]);
  addMatch(teamId, season.id, 'Lions', '2025-12-01', [[10, 5]]);
  addMatch(teamId, season.id, 'Lions', '2026-01-01');
  store().addOpponent(season.id, 'Bears');
  return season;
}

/** Season B (a newer tournament): one match vs Owls won 3:0. */
function seedSeasonB(teamId: string) {
  const season = store().addSeason({
    teamId,
    name: 'Summer Cup',
    kind: 'tournament',
    startDate: '2026-06-01',
  });
  addMatch(teamId, season.id, 'Owls', '2026-06-01', [
    [25, 10],
    [25, 10],
    [25, 10],
  ]);
  return season;
}

describe('seasons list (team → Matches tab)', () => {
  it('shows the empty state and creates a tournament, validating the form', async () => {
    const team = seedTeam();
    await renderRouter('./app', { initialUrl: `/team/${team.id}?tab=matches` });
    expect(screen.getByText(s.list.empty)).toBeTruthy();
    await press(s.list.newSeason);
    // v8: a new season starts today (dd.mm.yy); the end stays empty.
    expect(screen.getByLabelText(s.form.startDate).props.value).toMatch(/^\d\d\.\d\d\.\d\d$/);
    expect(screen.getByLabelText(s.form.endDate).props.value).toBe('');

    // v8: dates are typed Swiss style (dd.mm.yyyy and dd.mm.yy) and stored as ISO.
    await type(s.form.startDate, '02.06.2026');
    await type(s.form.endDate, '1.6.26');
    await press(s.form.create);
    expect(screen.getByText(s.errors.required)).toBeTruthy();
    expect(screen.getByText(s.errors.endBeforeStart)).toBeTruthy();
    expect(store().seasons).toHaveLength(0);

    await type(s.form.name, 'Summer Cup');
    await type(s.form.endDate, '03.06.26');
    await type(s.form.location, 'Munich');
    await fireEvent.press(screen.getByRole('radio', { name: s.kind.tournament }));
    await press(s.form.create);

    const season = store().seasons[0];
    expect(season).toMatchObject({
      teamId: team.id,
      name: 'Summer Cup',
      kind: 'tournament',
      startDate: '2026-06-02',
      endDate: '2026-06-03',
      location: 'Munich',
    });
    // Creating opens the new season.
    expect(screen).toHavePathname(`/team/${team.id}/season/${season.id}`);
    expect(screen.getByTestId('season-name')).toHaveTextContent('Summer Cup');
    expect(screen.getByText('02.06.26 – 03.06.26 · Munich')).toBeTruthy();
    expect(screen.getByTestId('kind-tournament')).toHaveTextContent(s.kind.tournament);
  });

  it('rejects a duplicate season name in the same team', async () => {
    const team = seedTeam();
    store().addSeason({ teamId: team.id, name: '2026/27', kind: 'season' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season-new` });
    await type(s.form.name, ' 2026/27 ');
    await press(s.form.create);
    expect(screen.getByText(s.errors.duplicateSeason)).toBeTruthy();
    expect(store().seasons).toHaveLength(1);
  });

  it('shows too-long and invalid-date errors', async () => {
    const team = seedTeam();
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season-new` });
    await type(s.form.name, 'x'.repeat(41));
    await type(s.form.location, 'y'.repeat(81));
    await type(s.form.startDate, '2026-02-30');
    await type(s.form.endDate, '2026-13-01');
    await press(s.form.create);
    expect(screen.getAllByText(s.errors.tooLong)).toHaveLength(2); // name and place
    expect(screen.getAllByText(s.errors.invalidDate)).toHaveLength(2); // start and end
    expect(store().seasons).toHaveLength(0);
  });

  it('shows the boxes newest first with their summary and opens a season', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    const b = seedSeasonB(team.id);
    store().addSeason({ teamId: team.id, name: 'Empty', kind: 'season', startDate: '2024-09-01' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}?tab=matches` });

    const ids = (await screen.findAllByRole('button'))
      .map((n) => n.props.testID as string | undefined)
      .filter((id) => id?.startsWith('season-') && id !== 'season-list');
    expect(ids.slice(0, 2)).toEqual([`season-${b.id}`, `season-${a.id}`]);
    expect(ids).toHaveLength(3);
    const summaries = screen.getAllByTestId('season-summary').map((n) => n.props.children);
    expect(summaries).toEqual(['1 match · 1–0', '4 matches · 1–1', '0 matches']);
    expect(screen.getByText('01.09.25 – 30.04.26 · Munich')).toBeTruthy();
    expect(screen.getByText('from 01.06.26')).toBeTruthy();

    await press('2025/26, Season, 01.09.25 – 30.04.26 · Munich, 4 matches · 1–1. Open');
    expect(screen).toHavePathname(`/team/${team.id}/season/${a.id}`);
    expect(screen.getByTestId('season-name')).toHaveTextContent('2025/26');
  });
});

describe('season screen', () => {
  it('edits a season, then deletes it with its matches after confirmation', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    const other = seedSeasonB(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}` });
    await press(s.screen.editLabel('2025/26'));
    expect(screen).toHavePathname(`/team/${team.id}/season-new`);
    expect(screen.getByLabelText(s.form.name).props.value).toBe('2025/26');
    expect(screen.getByLabelText(s.form.location).props.value).toBe('Munich');
    // v8: stored ISO dates are shown as dd.mm.yy in the form.
    expect(screen.getByLabelText(s.form.startDate).props.value).toBe('01.09.25');
    expect(screen.getByLabelText(s.form.endDate).props.value).toBe('30.04.26');

    await type(s.form.name, 'Liga 25/26');
    await type(s.form.location, '');
    await type(s.form.endDate, '');
    await press(t.common.save);
    expect(store().seasons.find((x) => x.id === a.id)).toEqual({
      id: a.id,
      teamId: team.id,
      name: 'Liga 25/26',
      kind: 'season',
      startDate: '2025-09-01',
      createdAt: a.createdAt,
    });
    expect(screen).toHavePathname(`/team/${team.id}/season/${a.id}`);
    expect(screen.getByTestId('season-name')).toHaveTextContent('Liga 25/26');
    expect(screen.getByText('from 01.09.25')).toBeTruthy();

    await press(s.screen.editLabel('Liga 25/26'));
    await press(s.form.delete);
    expect(screen.getByText(s.form.confirmDelete('Liga 25/26', 4))).toBeTruthy();
    // The dialog's Cancel (the form has one too).
    const cancels = screen.getAllByRole('button', { name: t.common.cancel });
    await fireEvent.press(cancels[cancels.length - 1]);
    expect(store().seasons).toHaveLength(2);
    await press(s.form.delete);
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().seasons.map((x) => x.id)).toEqual([other.id]);
    expect(store().matches.map((m) => m.opponent)).toEqual(['Owls']);
    expect(screen).toHavePathname(`/team/${team.id}`);
    expect(screen.getAllByTestId('season-summary')).toHaveLength(1);
  });

  it('lists only this season’s matches newest first, searches them and adds one here', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    seedSeasonB(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}` });
    const dates = () => screen.queryAllByText(/^\d\d\.\d\d\.\d\d · /).map((n) => n.props.children);
    expect(dates()).toEqual([
      '01.01.26 · Home',
      '01.12.25 · Home',
      '01.11.25 · Home',
      '01.10.25 · Home',
    ]);
    expect(screen.queryByText('vs Owls')).toBeNull();
    await type(t.roster.matches.search, '1.11.');
    expect(dates()).toEqual(['01.11.25 · Home']);
    expect(screen.getByTestId('match-search-status').props.children).toBe(
      t.roster.matches.resultCount(1, 4),
    );
    // v8: the shown dd.mm.yy form and its day-month start both find the match.
    await type(t.roster.matches.search, '01.12.');
    expect(dates()).toEqual(['01.12.25 · Home']);
    await type(t.roster.matches.search, '01.12.25');
    expect(dates()).toEqual(['01.12.25 · Home']);
    await type(t.roster.matches.search, 'owls');
    expect(screen.getByText(t.roster.matches.noResults('owls'))).toBeTruthy();

    await press(t.roster.matches.newMatch);
    expect(screen).toHavePathname(`/team/${team.id}/match-new`);
    expect(screen).toHaveSearchParams({ teamId: team.id, seasonId: a.id });
  });

  it('shows the record per opponent with literal numbers', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}?tab=opponents` });
    const lines = screen.getAllByTestId('opponent-record').map((n) => n.props.children);
    expect(lines).toEqual([
      '0–0 · 0 played · 0 upcoming · sets 0:0', // Bears
      '1–1 · 3 played · 1 in progress · 1 upcoming · sets 4:3', // Lions
    ]);
  });

  it('adds, renames (the matches follow) and deletes opponents', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}` });
    await fireEvent.press(screen.getByRole('tab', { name: s.screen.opponents }));
    expect(screen.getByRole('tab', { name: s.screen.opponents })).toBeSelected();

    await press(s.opponents.addLabel);
    expect(screen.getByText(s.errors.required)).toBeTruthy();
    await type(s.opponents.name, ' lions ');
    await press(s.opponents.addLabel);
    expect(screen.getByText(s.errors.duplicateOpponent)).toBeTruthy();
    await type(s.opponents.name, 'Owls');
    await press(s.opponents.addLabel);
    expect(
      store()
        .opponents.map((o) => o.name)
        .sort(),
    ).toEqual(['Bears', 'Lions', 'Owls']);
    expect(screen.getByLabelText(s.opponents.name).props.value).toBe('');

    // Rename: duplicate first, then a new name; every match against Lions follows.
    await press(s.opponents.renameLabel('Lions'));
    await type(s.opponents.newName('Lions'), 'bears');
    await press(t.common.save);
    expect(screen.getByText(s.errors.duplicateOpponent)).toBeTruthy();
    await type(s.opponents.newName('Lions'), 'Lions VC');
    await press(t.common.save);
    expect(store().matches.map((m) => m.opponent)).toEqual(Array(4).fill('Lions VC'));
    expect(screen.getByText('Lions VC')).toBeTruthy();

    // An opponent with matches can't be deleted; one without can, after confirmation.
    expect(screen.queryByRole('button', { name: s.opponents.deleteLabel('Lions VC') })).toBeNull();
    expect(screen.getByText(s.opponents.deleteBlocked)).toBeTruthy();
    await press(s.opponents.deleteLabel('Bears'));
    expect(screen.getByText(s.opponents.confirmDelete('Bears'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(
      store()
        .opponents.map((o) => o.name)
        .sort(),
    ).toEqual(['Lions VC', 'Owls']);
  });

  it('tapping an opponent filters the matches; the chip removes the filter', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    addMatch(team.id, a.id, 'Bears', '2026-02-01');
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}?tab=opponents` });
    const bears = findOpponentByName(store().opponents, a.id, 'Bears');
    await fireEvent.press(screen.getByTestId(`opponent-${bears?.id}`));
    expect(screen).toHaveSearchParams({ teamId: team.id, seasonId: a.id, tab: 'matches' });
    expect(screen.getByTestId('opponent-filter')).toBeTruthy();
    const rows = () => screen.queryAllByText(/^vs [^✕]*$/).map((n) => n.props.children);
    expect(rows()).toEqual(['vs Bears']);
    await fireEvent.press(screen.getByLabelText(s.matches.filterLabel('Bears')));
    expect(screen.queryByTestId('opponent-filter')).toBeNull();
    expect(rows()).toHaveLength(5);
  });

  it('filtering by an opponent without matches says so', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}?tab=opponents` });
    const bears = findOpponentByName(store().opponents, a.id, 'Bears');
    await fireEvent.press(screen.getByTestId(`opponent-${bears?.id}`));
    expect(screen.getByText(s.matches.emptyFor('Bears'))).toBeTruthy();
    expect(screen.queryByText(s.matches.empty)).toBeNull();
    await press(s.matches.filterLabel('Bears'));
    expect(screen.queryByText(s.matches.emptyFor('Bears'))).toBeNull();
  });

  it('the Stats tab shows only this season’s matches', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    const b = seedSeasonB(team.id);
    const empty = store().addSeason({ teamId: team.id, name: 'Next', kind: 'season' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${b.id}?tab=stats` });
    expect(screen.getByTestId('season-record')).toHaveTextContent(/^1–0/);
    expect(screen.getByTestId('season-points')).toHaveTextContent(/^75 : 30/);
    expect(screen.getByTestId('player-table')).toBeTruthy();

    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}?tab=stats` });
    expect(screen.getByTestId('season-record')).toHaveTextContent(/^1–1/);
    expect(screen.getByTestId('season-sets')).toHaveTextContent(/^4 : 3/);

    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${empty.id}?tab=stats` });
    expect(screen.getByText(s.stats.empty)).toBeTruthy();
  });

  it('shows not found for an unknown season or one of another team', async () => {
    const team = seedTeam();
    const otherTeam = store().addTeam({ profileId: team.profileId, name: 'Damen' });
    const foreign = store().addSeason({ teamId: otherTeam.id, name: 'X', kind: 'season' });
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${foreign.id}` });
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season-new?seasonId=nope` });
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
    await press(s.form.backToTeam);
    expect(screen).toHavePathname(`/team/${team.id}`);
  });

  it('works in German', async () => {
    const team = seedTeam();
    const a = seedSeasonA(team.id);
    store().setLanguage('de');
    await renderRouter('./app', { initialUrl: `/team/${team.id}?tab=matches` });
    expect(screen.getByText('4 Spiele · 1–1')).toBeTruthy();
    expect(screen.getByRole('button', { name: de.seasons.list.newSeason })).toBeTruthy();
    await renderRouter('./app', { initialUrl: `/team/${team.id}/season/${a.id}?tab=opponents` });
    expect(screen.getByRole('tab', { name: de.seasons.screen.opponents })).toBeSelected();
    expect(screen.getByText('1–1 · 3 gespielt · 1 laufend · 1 geplant · Sätze 4:3')).toBeTruthy();
  });
});
