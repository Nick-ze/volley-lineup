/**
 * v12 PR 3: the tournament screen with its Teams and Matches tabs, and the result screen.
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

/** A tournament of the selected profile with these teams. */
function seedCup(
  names: string[],
  extra: { setsPerMatch?: 1 | 2 | 3 | 4 | 5; allSets?: boolean } = {},
) {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    setsPerMatch: extra.setsPerMatch ?? 3,
    matchEnd: extra.allSets ? 'allSets' : 'bestOf',
  });
  const teams = names.map((name) => store().addHostedTeam(cup.id, name));
  return { cup, teams };
}

const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);
const tabChip = (tab: string) => screen.getByTestId(`tournament-tab-${tab}`);
const score = async (set: number, a: string, b: string) => {
  await type(`result-set-${set}-a`, a);
  await type(`result-set-${set}-b`, b);
};

describe('tournament screen', () => {
  it('opens on Teams while there are fewer than two teams', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}`);
    expect(tabChip('teams')).toBeSelected();
    expect(screen.getByTestId('hosted-team-count')).toHaveTextContent('1 of 16 teams');
  });

  it('opens on Matches with two teams or more', async () => {
    const { cup } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}`);
    expect(tabChip('matches')).toBeSelected();
    expect(screen.getByTestId('plan-played')).toHaveTextContent('0 of 1 played');
  });

  it('?tab= wins, and the chips switch the tab', async () => {
    const { cup } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    expect(tabChip('teams')).toBeSelected();
    await fireEvent.press(screen.getByTestId('tournament-tab-matches'));
    expect(tabChip('matches')).toBeSelected();
    expect(screen.getByTestId('plan-round-1')).toBeTruthy();
  });

  it('stays on Teams when the second team is added', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}`);
    await type('hosted-team-name', 'Rivals');
    await fireEvent.press(screen.getByTestId('hosted-team-add'));
    expect(store().hostedTeams).toHaveLength(2);
    expect(tabChip('teams')).toBeSelected();
  });
});

describe('Teams tab', () => {
  it('adds teams in order, trimmed, and clears the field', async () => {
    const { cup } = seedCup([]);
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.getByText(s.teams.empty)).toBeTruthy();
    expect(screen.getByText(s.teams.hint)).toBeTruthy();
    await type('hosted-team-name', '  TV   Nord ');
    await press(s.teams.addLabel);
    await type('hosted-team-name', 'Rivals');
    await fireEvent(screen.getByTestId('hosted-team-name'), 'submitEditing');
    expect(store().hostedTeams.map((x) => [x.name, x.order])).toEqual([
      ['TV Nord', 0],
      ['Rivals', 1],
    ]);
    expect(screen.getByTestId('hosted-team-name').props.value).toBe('');
    expect(screen.getByTestId('hosted-team-count')).toHaveTextContent('2 of 16 teams');
    expect(screen.queryByText(s.teams.empty)).toBeNull();
  });

  it('refuses an empty and a duplicate name with a text', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}`);
    await press(s.teams.addLabel);
    expect(screen.getByText(s.errors.required)).toBeTruthy();
    await type('hosted-team-name', 'tv nord');
    expect(screen.queryByText(s.errors.required)).toBeNull();
    await press(s.teams.addLabel);
    expect(screen.getByText(s.errors.duplicateTeam)).toBeTruthy();
    expect(store().hostedTeams).toHaveLength(1);
  });

  it('refuses a 17th team', async () => {
    const { cup } = seedCup(Array.from({ length: 16 }, (_, i) => `Team ${i + 1}`));
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    expect(screen.getByTestId('hosted-team-count')).toHaveTextContent('16 of 16 teams');
    await type('hosted-team-name', 'One more');
    await press(s.teams.addLabel);
    expect(screen.getByText(s.errors.tooManyTeams(16))).toBeTruthy();
    expect(store().hostedTeams).toHaveLength(16);
  });

  it('renames a team; a name another team has is refused', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    await press(s.teams.renameLabel('Rivals'));
    expect(screen.getByLabelText(s.teams.newName('Rivals')).props.value).toBe('Rivals');
    await type('hosted-team-rename', 'TV NORD');
    await press(t.common.save);
    expect(screen.getByText(s.errors.duplicateTeam)).toBeTruthy();
    await type('hosted-team-rename', 'Rivals II');
    await press(t.common.save);
    expect(store().hostedTeams.find((x) => x.id === teams[1].id)?.name).toBe('Rivals II');
    expect(screen.queryByTestId(`hosted-team-edit-${teams[1].id}`)).toBeNull();
    // Cancel leaves the name alone.
    await press(s.teams.renameLabel('TV Nord'));
    await type('hosted-team-rename', 'Changed');
    await press(t.common.cancel);
    expect(store().hostedTeams[0].name).toBe('TV Nord');
  });

  it('removes a team without results after a plain question', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    await press(s.teams.deleteLabel('Rivals'));
    expect(screen.getByText('Remove “Rivals” from the tournament?')).toBeTruthy();
    await press(t.common.cancel);
    expect(store().hostedTeams).toHaveLength(2);
    await press(s.teams.deleteLabel('Rivals'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedTeams.map((x) => x.id)).toEqual([teams[0].id]);
  });

  it('removing a team with results asks, says how many go, and deletes them', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals', 'SC Blau']);
    const [a, b, c] = teams;
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 20 }]);
    store().setHostedResult(cup.id, b.id, c.id, [{ a: 25, b: 20 }]);
    const kept = store().setHostedResult(cup.id, a.id, c.id, [{ a: 25, b: 20 }]);
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    await press(s.teams.deleteLabel('Rivals'));
    expect(
      screen.getByText('Remove “Rivals” from the tournament? Its 2 results are deleted with it.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedTeams.map((x) => x.name)).toEqual(['TV Nord', 'SC Blau']);
    expect(store().hostedResults).toEqual([kept]);
  });
});

describe('Matches tab', () => {
  it('asks for two teams when there is no plan yet', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}?tab=matches`);
    expect(screen.getByTestId('plan-empty')).toHaveTextContent(s.matches.empty);
  });

  it('shows every pair once, in rounds, with the resting team of an odd number', async () => {
    const { cup, teams } = seedCup(['A', 'B', 'C', 'D', 'E']);
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.getByTestId('plan-played')).toHaveTextContent('0 of 10 played');
    const rows = screen.getAllByTestId(/^plan-match-/);
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((row) => row.props.testID)).size).toBe(10);
    for (let round = 1; round <= 5; round += 1) {
      const box = within(screen.getByTestId(`plan-round-${round}`));
      expect(box.getByText(s.matches.round(round))).toBeTruthy();
      expect(box.getAllByTestId(/^plan-match-/)).toHaveLength(2);
      expect(box.getByTestId(`plan-resting-${round}`)).toBeTruthy();
    }
    // Every team rests once.
    const resting = [1, 2, 3, 4, 5].map(
      (round) => screen.getByTestId(`plan-resting-${round}`).props.children,
    );
    expect([...resting].sort()).toEqual(teams.map((x) => s.matches.resting(x.name)).sort());
  });

  it('has no resting line with an even number of teams', async () => {
    const { cup } = seedCup(['A', 'B', 'C', 'D']);
    await renderApp(`/tournament/${cup.id}`);
    expect(screen.getAllByTestId(/^plan-match-/)).toHaveLength(6);
    expect(screen.queryByTestId(/^plan-resting-/)).toBeNull();
  });

  it('reads a match like a scoreboard line and says so to a screen reader', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    await renderApp(`/tournament/${cup.id}`);
    const row = () => screen.getByTestId(`plan-match-${a.id}-${b.id}`);
    expect(row().props.accessibilityLabel).toBe('TV Nord – Rivals, not played yet. Enter result');
    expect(within(row()).getByText(s.matches.open)).toBeTruthy();

    store().setHostedResult(cup.id, a.id, b.id, [
      { a: 25, b: 27 },
      { a: 25, b: 19 },
      { a: 13, b: 15 },
    ]);
    await screen.findByText('27');
    expect(row().props.accessibilityLabel).toBe(
      'TV Nord – Rivals, 1:2 (25:27, 25:19, 13:15). Change result',
    );
    expect(screen.getByTestId('plan-played')).toHaveTextContent('1 of 1 played');
  });

  it('says of a match that is not over that it is not finished', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    store().setHostedResult(cup.id, a.id, b.id, [
      { a: 25, b: 23 },
      { a: 20, b: 25 },
    ]);
    await renderApp(`/tournament/${cup.id}`);
    // 1:1 in a best of 3 is running, not a draw.
    expect(screen.getByTestId(`plan-match-${a.id}-${b.id}`).props.accessibilityLabel).toBe(
      'TV Nord – Rivals, 1:1 (25:23, 20:25), not finished. Change result',
    );
    expect(screen.getByTestId('plan-played')).toHaveTextContent('0 of 1 played');
  });

  it('tapping a match opens its result', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}`);
    await fireEvent.press(screen.getByTestId(`plan-match-${teams[0].id}-${teams[1].id}`));
    expect(screen).toHavePathname(`/tournament/${cup.id}/match`);
    expect(screen.getByTestId('result-screen')).toBeTruthy();
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Winter Cup · Round 1 · best of 3',
    );
  });
});

describe('result screen', () => {
  const open = async (cupId: string, a: string, b: string) =>
    renderApp(`/tournament/${cupId}/match?a=${a}&b=${b}`);

  it('enters a best-of-3 result set by set; the next row appears when it can be played', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    await open(cup.id, a.id, b.id);
    expect(screen.getByLabelText(s.result.scoreLabel(1, 'TV Nord'))).toBeTruthy();
    expect(screen.getByLabelText(s.result.scoreLabel(1, 'Rivals'))).toBeTruthy();
    expect(screen.queryByTestId('result-set-2')).toBeNull();
    expect(screen.queryByTestId('result-delete')).toBeNull();

    await score(1, '25', '22');
    expect(screen.getByTestId('result-sets-a')).toHaveTextContent('1');
    expect(screen.getByTestId('result-set-2')).toBeTruthy();
    await score(2, '21', '25');
    expect(screen.getByTestId('result-sets-b')).toHaveTextContent('1');
    // 1:1 — the third set can be played.
    expect(screen.getByTestId('result-set-3')).toBeTruthy();
    await score(3, '15', '13');
    expect(screen.getByTestId('result-sets-a')).toHaveTextContent('2');
    expect(screen.queryByTestId('result-set-4')).toBeNull();

    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults).toHaveLength(1);
    expect(store().hostedResults[0]).toMatchObject({
      tournamentId: cup.id,
      teamAId: a.id,
      teamBId: b.id,
      sets: [
        { a: 25, b: 22 },
        { a: 21, b: 25 },
        { a: 15, b: 13 },
      ],
    });
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('in best-of no set can be added after the deciding one', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, teams[1].id);
    await score(1, '25', '22');
    await score(2, '25', '20');
    // 2:0 — over.
    expect(screen.queryByTestId('result-set-3')).toBeNull();
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults[0].sets).toHaveLength(2);
  });

  it('with "all sets" every set is played and a draw is stored', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals'], { setsPerMatch: 2, allSets: true });
    await open(cup.id, teams[0].id, teams[1].id);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Winter Cup · Round 1 · 2 sets',
    );
    await score(1, '25', '22');
    await score(2, '20', '25');
    expect(screen.queryByTestId('result-set-3')).toBeNull();
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults[0].sets).toEqual([
      { a: 25, b: 22 },
      { a: 20, b: 25 },
    ]);
  });

  it('refuses invalid sets with a text under the row', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, teams[1].id);
    // Nothing entered.
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(screen.getByTestId('result-error')).toHaveTextContent(s.result.errors.EMPTY);
    // Equal scores: said at once, no next row, not saved.
    await score(1, '25', '25');
    expect(screen.queryByTestId('result-error')).toBeNull();
    expect(screen.getByTestId('result-set-1-error')).toHaveTextContent(s.result.errors.EQUAL);
    expect(screen.queryByTestId('result-set-2')).toBeNull();
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults).toEqual([]);
    // One field missing: said on Save.
    await type('result-set-1-b', '');
    expect(screen.queryByTestId('result-set-1-error')).toBeNull();
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(screen.getByTestId('result-set-1-error')).toHaveTextContent(s.result.errors.INCOMPLETE);
    expect(store().hostedResults).toEqual([]);
    expect(screen).toHavePathname(`/tournament/${cup.id}/match`);
  });

  it('keeps only digits, two at most', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, teams[1].id);
    await type('result-set-1-a', '2x5');
    expect(screen.getByTestId('result-set-1-a').props.value).toBe('25');
    await type('result-set-1-a', '1234');
    expect(screen.getByTestId('result-set-1-a').props.value).toBe('12');
  });

  it('saves an unfinished result: the match is running', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, teams[1].id);
    await score(1, '25', '22');
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults[0].sets).toEqual([{ a: 25, b: 22 }]);
  });

  it('changes a result; clearing the last set removes it', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    const first = store().setHostedResult(cup.id, a.id, b.id, [
      { a: 25, b: 22 },
      { a: 21, b: 25 },
      { a: 15, b: 13 },
    ]);
    // The pair given the other way round shows the same order as the plan.
    await open(cup.id, b.id, a.id);
    expect(screen.getByTestId('result-set-1-a').props.value).toBe('25');
    expect(screen.getByTestId('result-set-3-b').props.value).toBe('13');
    expect(screen.getByTestId('result-sets-a')).toHaveTextContent('2');
    await score(3, '', '');
    expect(screen.getByTestId('result-sets-a')).toHaveTextContent('1');
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults).toEqual([
      {
        ...first,
        sets: [
          { a: 25, b: 22 },
          { a: 21, b: 25 },
        ],
      },
    ]);
  });

  it('a change that decides the match earlier drops the later set', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    store().setHostedResult(cup.id, a.id, b.id, [
      { a: 25, b: 22 },
      { a: 21, b: 25 },
      { a: 15, b: 13 },
    ]);
    await open(cup.id, a.id, b.id);
    await score(2, '25', '21');
    expect(screen.queryByTestId('result-set-3')).toBeNull();
    await fireEvent.press(screen.getByTestId('result-save'));
    expect(store().hostedResults[0].sets).toEqual([
      { a: 25, b: 22 },
      { a: 25, b: 21 },
    ]);
  });

  it('deletes a result after the question', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    const [a, b] = teams;
    store().setHostedResult(cup.id, a.id, b.id, [{ a: 25, b: 22 }]);
    await open(cup.id, a.id, b.id);
    await press(s.result.delete);
    expect(screen.getByText(s.result.confirmDelete('TV Nord', 'Rivals'))).toBeTruthy();
    // The dialog's Cancel (the form has one too; the dialog is drawn last).
    const cancels = screen.getAllByRole('button', { name: t.common.cancel });
    await fireEvent.press(cancels[cancels.length - 1]);
    expect(store().hostedResults).toHaveLength(1);
    await press(s.result.delete);
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedResults).toEqual([]);
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('Cancel saves nothing', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, teams[1].id);
    await score(1, '25', '22');
    await press(t.common.cancel);
    expect(store().hostedResults).toEqual([]);
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('shows "not found" for a pair that is not in the plan', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await open(cup.id, teams[0].id, 'nobody');
    expect(screen.getByText(s.result.notFound)).toBeTruthy();
    await press(s.team.back);
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
  });

  it('shows "not found" for another profile’s tournament', async () => {
    const { teams } = seedCup(['TV Nord', 'Rivals']);
    const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
    const theirs = store().addHostedTournament({
      profileId: other.id,
      name: 'Theirs',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    await open(theirs.id, teams[0].id, teams[1].id);
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
  });

  it('is in German when the language is German', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    useAppStore.setState({ language: 'de' });
    await open(cup.id, teams[0].id, teams[1].id);
    expect(screen.getByRole('header', { name: 'Ergebnis' })).toBeTruthy();
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Winter Cup · Runde 1 · Best of 3',
    );
    expect(screen.getByLabelText(de.tournament.result.scoreLabel(1, 'TV Nord'))).toBeTruthy();
    expect(screen.getByText(de.tournament.result.hint)).toBeTruthy();
  });
});
