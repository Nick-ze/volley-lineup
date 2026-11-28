/**
 * v12.1: a hosted tournament whose matches the coach adds ("I enter the matches myself").
 */
import { fireEvent, screen, within } from '@testing-library/react-native';

import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useAppStore } from '@/store';
import { renderApp, resetStores } from '@/test-utils';

const s = t.tournament;
const store = () => useAppStore.getState();

beforeEach(() => {
  resetStores();
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
});

function seedProfile() {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  return profile;
}

/** A tournament with own matches and these teams. */
function seedOwn(names: string[] = ['Hosts', 'TV Nord', 'Rivals']) {
  const profile = seedProfile();
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Friendlies',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
    plan: 'manual',
  });
  const teams = names.map((name) => store().addHostedTeam(cup.id, name));
  return { profile, cup, teams };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);
const chip = (id: string) => screen.getByTestId(`add-match-team-${id}`);
const addButton = () => screen.getByTestId('add-match-button');
const matchRows = () => screen.queryAllByTestId(/^plan-match-/);

describe('the form’s choice of who makes the plan', () => {
  it('offers both, the app-made plan first, and says what each means', async () => {
    seedProfile();
    await renderApp('/tournament-new');
    expect(screen.getByTestId('tournament-plan-roundRobin')).toBeChecked();
    expect(screen.getByTestId('tournament-plan-hint')).toHaveTextContent(
      s.form.planHint.roundRobin,
    );
    await fireEvent.press(screen.getByTestId('tournament-plan-manual'));
    expect(screen.getByTestId('tournament-plan-manual')).toBeChecked();
    expect(screen.getByTestId('tournament-plan-hint')).toHaveTextContent(s.form.planHint.manual);
  });

  it('creates a tournament with own matches', async () => {
    seedProfile();
    await renderApp('/tournament-new');
    await type('tournament-name', 'Friendlies');
    await fireEvent.press(screen.getByRole('radio', { name: s.form.planOption.manual }));
    await press(s.form.create);
    expect(store().hostedTournaments[0]).toMatchObject({ name: 'Friendlies', plan: 'manual' });
  });

  it('can be changed while nothing is stored', async () => {
    const { cup } = seedOwn();
    await renderApp(`/tournament-new?tournamentId=${cup.id}`);
    expect(screen.getByTestId('tournament-plan-manual')).toBeChecked();
    await fireEvent.press(screen.getByTestId('tournament-plan-roundRobin'));
    await press(t.common.save);
    expect(store().hostedTournaments[0].plan).toBe('roundRobin');
  });

  it('is fixed once the tournament has a match, and says so', async () => {
    const { cup, teams } = seedOwn();
    store().addHostedMatch(cup.id, teams[0].id, teams[1].id);
    await renderApp(`/tournament-new?tournamentId=${cup.id}`);
    expect(screen.getByTestId('tournament-plan-hint')).toHaveTextContent(
      `${s.form.planHint.manual} ${s.form.planLocked}`,
    );
    expect(screen.getByTestId('tournament-plan-roundRobin')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('tournament-plan-roundRobin'));
    await type('tournament-name', 'Renamed');
    await press(t.common.save);
    expect(store().hostedTournaments[0]).toMatchObject({ name: 'Renamed', plan: 'manual' });
    expect(store().hostedResults).toHaveLength(1);
  });

  it('is fixed for a round robin with a result too', async () => {
    const profile = seedProfile();
    const cup = store().addHostedTournament({
      profileId: profile.id,
      name: 'Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    const a = store().addHostedTeam(cup.id, 'A');
    const b = store().addHostedTeam(cup.id, 'B');
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 20 }]);
    await renderApp(`/tournament-new?tournamentId=${cup.id}`);
    expect(screen.getByTestId('tournament-plan-manual')).toBeDisabled();
    expect(screen.getByTestId('tournament-plan-roundRobin')).toBeChecked();
  });
});

describe('Matches tab with own matches', () => {
  it('asks for two teams first', async () => {
    const { cup } = seedOwn(['Hosts']);
    await renderApp(`/tournament/${cup.id}?tab=matches`);
    expect(screen.getByTestId('plan-empty')).toHaveTextContent(s.matches.emptyManualTeams);
    expect(screen.queryByTestId('add-match')).toBeNull();
  });

  it('shows no plan of its own: the list is empty until a match is added', async () => {
    const { cup } = seedOwn();
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.getByTestId('plan-empty')).toHaveTextContent(s.matches.emptyManual);
    expect(matchRows()).toHaveLength(0);
    expect(screen.getByText(s.matches.choose)).toBeTruthy();
    expect(addButton()).toBeDisabled();
  });

  it('adds a match between the two teams chosen, the first tapped on top', async () => {
    const { cup, teams } = seedOwn();
    const [hosts, nord] = teams;
    await renderApp(`/tournament/${cup.id}`);
    await fireEvent.press(chip(nord.id));
    expect(addButton()).toBeDisabled();
    await fireEvent.press(chip(hosts.id));
    expect(screen.getByTestId('add-match-pair')).toHaveTextContent('TV Nord – Hosts');
    await fireEvent.press(addButton());

    expect(store().hostedResults).toHaveLength(1);
    expect(store().hostedResults[0]).toMatchObject({
      tournamentId: cup.id,
      teamAId: nord.id,
      teamBId: hosts.id,
      sets: [],
    });
    // The choice is cleared for the next match.
    expect(screen.queryByTestId('add-match-pair')).toBeNull();
    expect(addButton()).toBeDisabled();
    expect(screen.getByTestId('plan-played')).toHaveTextContent('0 of 1 played');
    expect(matchRows()).toHaveLength(1);
    expect(matchRows()[0].props.accessibilityLabel).toBe(
      'TV Nord – Hosts, not played yet. Enter result',
    );
    expect(screen.getByText(s.matches.match(1))).toBeTruthy();
  });

  it('a third team takes the second one’s place; tapping a chosen team takes it out', async () => {
    const { cup, teams } = seedOwn();
    const [hosts, nord, rivals] = teams;
    await renderApp(`/tournament/${cup.id}`);
    await fireEvent.press(chip(hosts.id));
    await fireEvent.press(chip(nord.id));
    await fireEvent.press(chip(rivals.id));
    expect(screen.getByTestId('add-match-pair')).toHaveTextContent('Hosts – Rivals');
    expect(chip(nord.id)).not.toBeChecked();
    await fireEvent.press(chip(hosts.id));
    expect(screen.queryByTestId('add-match-pair')).toBeNull();
    expect(chip(rivals.id)).toBeChecked();
    expect(addButton()).toBeDisabled();
  });

  it('the same two teams can meet more than once', async () => {
    const { cup, teams } = seedOwn();
    const [hosts, nord] = teams;
    await renderApp(`/tournament/${cup.id}`);
    for (let i = 0; i < 2; i += 1) {
      await fireEvent.press(chip(hosts.id));
      await fireEvent.press(chip(nord.id));
      await fireEvent.press(addButton());
    }
    expect(store().hostedResults).toHaveLength(2);
    expect(matchRows()).toHaveLength(2);
    expect(screen.getByText(s.matches.match(2))).toBeTruthy();
    expect(new Set(matchRows().map((row) => row.props.testID)).size).toBe(2);
  });

  it('refuses a 201st match with a text', async () => {
    const { cup, teams } = seedOwn();
    const [hosts, nord] = teams;
    useAppStore.setState({
      hostedResults: Array.from({ length: 200 }, (_, i) => ({
        id: `m${i}`,
        tournamentId: cup.id,
        teamAId: hosts.id,
        teamBId: nord.id,
        sets: [],
      })),
    });
    await renderApp(`/tournament/${cup.id}`);
    await fireEvent.press(chip(hosts.id));
    await fireEvent.press(chip(nord.id));
    await fireEvent.press(addButton());
    expect(screen.getByTestId('add-match-error')).toHaveTextContent(s.matches.tooMany(200));
    expect(store().hostedResults).toHaveLength(200);
  });

  it('a round robin has no "Add match"', async () => {
    const profile = seedProfile();
    const cup = store().addHostedTournament({
      profileId: profile.id,
      name: 'Cup',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    store().addHostedTeam(cup.id, 'A');
    store().addHostedTeam(cup.id, 'B');
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.queryByTestId('add-match')).toBeNull();
    expect(screen.getByTestId('plan-round-1')).toBeTruthy();
  });
});

describe('the result of an added match', () => {
  function seedMatches() {
    const base = seedOwn();
    const [hosts, nord] = base.teams;
    const first = store().addHostedMatch(base.cup.id, hosts.id, nord.id);
    const second = store().addHostedMatch(base.cup.id, hosts.id, nord.id);
    if (!first || !second) throw new Error('seed');
    return { ...base, first, second };
  }
  const score = async (set: number, a: string, b: string) => {
    await type(`result-set-${set}-a`, a);
    await type(`result-set-${set}-b`, b);
  };

  it('opens from the list and is saved for that match only', async () => {
    const { cup, first, second } = seedMatches();
    await renderApp(`/tournament/${cup.id}`);
    await fireEvent.press(screen.getByTestId(`plan-match-${second.id}`));
    expect(screen).toHavePathname(`/tournament/${cup.id}/match`);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Friendlies · Match 2 · best of 3',
    );
    await score(1, '25', '20');
    await score(2, '25', '22');
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults.find((r) => r.id === first.id)?.sets).toEqual([]);
    expect(store().hostedResults.find((r) => r.id === second.id)?.sets).toEqual([
      { a: 25, b: 20 },
      { a: 25, b: 22 },
    ]);
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('clearing every set and saving leaves the match without a result', async () => {
    const { cup, first } = seedMatches();
    store().setHostedMatchSets(first.id, [{ a: 25, b: 20 }]);
    await renderApp(`/tournament/${cup.id}/match?m=${first.id}`);
    expect(screen.getByTestId('result-set-1-a').props.value).toBe('25');
    await score(1, '', '');
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(screen.queryByTestId('result-error')).toBeNull();
    expect(store().hostedResults.find((r) => r.id === first.id)?.sets).toEqual([]);
    expect(store().hostedResults).toHaveLength(2);
  });

  it('"Delete match" removes the match after the question, not the pair’s other match', async () => {
    const { cup, first, second } = seedMatches();
    await renderApp(`/tournament/${cup.id}/match?m=${first.id}`);
    await press(s.result.deleteMatch);
    expect(screen.getByText(s.result.confirmDeleteMatch('Hosts', 'TV Nord'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedResults.map((r) => r.id)).toEqual([second.id]);
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('shows "not found" without a match id, for an unknown one, and for a pair', async () => {
    const { cup, teams } = seedMatches();
    await renderApp(`/tournament/${cup.id}/match?m=nope`);
    expect(screen.getByText(s.result.notFound)).toBeTruthy();
    await renderApp(`/tournament/${cup.id}/match?a=${teams[0].id}&b=${teams[1].id}`);
    expect(screen.getByText(s.result.notFound)).toBeTruthy();
  });
});

describe('table, team and teams with own matches', () => {
  function seedPlayed() {
    const base = seedOwn();
    const [hosts, nord, rivals] = base.teams;
    const add = (a: string, b: string, sets: [number, number][]) => {
      const match = store().addHostedMatch(base.cup.id, a, b);
      if (!match) throw new Error('seed');
      store().setHostedMatchSets(
        match.id,
        sets.map(([x, y]) => ({ a: x, b: y })),
      );
      return match;
    };
    // Hosts beat TV Nord twice; Rivals beat Hosts; one match without a result.
    add(hosts.id, nord.id, [
      [25, 20],
      [25, 20],
    ]);
    add(nord.id, hosts.id, [
      [20, 25],
      [20, 25],
    ]);
    add(rivals.id, hosts.id, [
      [25, 23],
      [25, 23],
    ]);
    add(nord.id, rivals.id, []);
    return { ...base, hosts, nord, rivals };
  }

  it('the table counts every played match', async () => {
    const { cup, hosts, nord, rivals } = seedPlayed();
    await renderApp(`/tournament/${cup.id}?tab=table`);
    const points = (id: string) => screen.getByTestId(`table-points-${id}`).props.children;
    const order = within(screen.getByTestId('table-list'))
      .getAllByTestId(/^table-row-/)
      .map((row) => row.props.testID);
    expect(order).toEqual([
      `table-row-${hosts.id}`,
      `table-row-${rivals.id}`,
      `table-row-${nord.id}`,
    ]);
    expect([hosts, rivals, nord].map((x) => points(x.id))).toEqual([4, 2, 0]);
    expect(
      within(screen.getByTestId(`table-row-${hosts.id}`)).getByText('3 played ·'),
    ).toBeTruthy();
  });

  it('a team’s screen lists its matches under their numbers', async () => {
    const { cup, nord } = seedPlayed();
    await renderApp(`/tournament/${cup.id}/team/${nord.id}`);
    const rows = within(screen.getByTestId('team-matches')).getAllByTestId(/^team-match-/);
    expect(rows).toHaveLength(3);
    expect(screen.getByText(s.matches.match(1))).toBeTruthy();
    expect(screen.getByText(s.matches.match(2))).toBeTruthy();
    expect(screen.getByText(s.matches.match(4))).toBeTruthy();
    expect(screen.queryByText(s.matches.match(3))).toBeNull();
    await fireEvent.press(rows[2]);
    expect(screen).toHavePathname(`/tournament/${cup.id}/match`);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Friendlies · Match 4 · best of 3',
    );
  });

  it('the Teams tab says that the matches are added by hand; removing a team says how many go', async () => {
    const { cup, nord } = seedPlayed();
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    expect(screen.getByText(s.teams.hintManual)).toBeTruthy();
    expect(screen.queryByText(s.teams.hint)).toBeNull();
    await press(s.teams.deleteLabel('TV Nord'));
    expect(
      screen.getByText('Remove “TV Nord” from the tournament? Its 3 matches are deleted with it.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedResults).toHaveLength(1);
    expect(store().hostedTeams.some((team) => team.id === nord.id)).toBe(false);
  });

  it('the Tournaments tab counts the added matches', async () => {
    seedPlayed();
    await renderApp('/tournaments');
    expect(screen.getByText('3 of 4 played')).toBeTruthy();
    await press(s.list.deleteLabel('Friendlies'));
    expect(
      screen.getByText('Delete tournament “Friendlies” with its 3 teams and 3 results?'),
    ).toBeTruthy();
  });

  it('is in German when the language is German', async () => {
    const { cup } = seedPlayed();
    useAppStore.setState({ language: 'de' });
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.getByText(de.tournament.matches.choose)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Spiel hinzufügen' })).toBeTruthy();
    expect(screen.getByText('Spiel 1')).toBeTruthy();
  });
});
