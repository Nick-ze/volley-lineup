/**
 * v12 PR 4: the Table tab and a team's matches screen.
 */
import { fireEvent, screen, within } from '@testing-library/react-native';

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

type Sets = [number, number][];

function seedCup(
  names: string[],
  settings: { setsPerMatch: 1 | 2 | 3 | 4 | 5; matchEnd: 'bestOf' | 'allSets' } = {
    setsPerMatch: 3,
    matchEnd: 'bestOf',
  },
) {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    ...settings,
  });
  const teams = names.map((name) => store().addHostedTeam(cup.id, name));
  const play = (a: number, b: number, sets: Sets) =>
    store().setHostedResult(
      cup.id,
      teams[a].id,
      teams[b].id,
      sets.map(([x, y]) => ({ a: x, b: y })),
    );
  return { cup, teams, play };
}

/** The team ids of the table's rows, top to bottom. */
const order = () =>
  within(screen.getByTestId('table-list'))
    .getAllByTestId(/^table-row-/)
    .map((row) => (row.props.testID as string).replace('table-row-', ''));

const rank = (id: string) => screen.getByTestId(`table-rank-${id}`);
const points = (id: string) => screen.getByTestId(`table-points-${id}`);

describe('Table tab', () => {
  it('is the first tab; with fewer than two teams it asks for teams', async () => {
    const { cup } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.props.testID);
    expect(tabs).toEqual([
      'tournament-tab-table',
      'tournament-tab-matches',
      'tournament-tab-teams',
    ]);
    expect(screen.getByTestId('table-empty')).toHaveTextContent(s.table.empty);
  });

  it('best of: counts matches, 2 for a win, and ranks by points, sets, balls', async () => {
    const { cup, teams, play } = seedCup(['TV Nord', 'Rivals', 'SC Blau', 'VBC Süd']);
    const [nord, rivals, blau, sud] = teams;
    play(0, 1, [
      [25, 20],
      [25, 20],
    ]); // TV Nord 2:0 Rivals
    play(2, 3, [
      [25, 23],
      [23, 25],
      [15, 13],
    ]); // SC Blau 2:1 VBC Süd
    play(0, 2, [
      [25, 10],
      [20, 25],
      [15, 10],
    ]); // TV Nord 2:1 SC Blau
    play(1, 3, [
      [25, 5],
      [25, 5],
    ]); // Rivals 2:0 VBC Süd
    play(0, 3, [[25, 20]]); // running: counts for nothing
    await renderApp(`/tournament/${cup.id}?tab=table`);

    expect(order()).toEqual([nord.id, rivals.id, blau.id, sud.id]);
    expect([nord, rivals, blau, sud].map((x) => rank(x.id).props.children)).toEqual([1, 2, 3, 4]);
    expect([nord, rivals, blau, sud].map((x) => points(x.id).props.children)).toEqual([4, 2, 2, 0]);
    const first = within(screen.getByTestId(`table-row-${nord.id}`));
    expect(first.getByText('TV Nord')).toBeTruthy();
    expect(first.getByText('2 played ·')).toBeTruthy();
    expect(first.getByText('2–0 ·')).toBeTruthy();
    expect(first.getByText('sets 4:1 ·')).toBeTruthy();
    expect(first.getByText('balls +25')).toBeTruthy();
    expect(first.getByText(s.table.unit.matches)).toBeTruthy();
    expect(within(screen.getByTestId(`table-row-${sud.id}`)).getByText('balls −42')).toBeTruthy();
    expect(screen.getByTestId(`table-row-${nord.id}`).props.accessibilityLabel).toBe(
      '1. TV Nord, 2 played · 2–0 · sets 4:1 · balls +25, 4 Matches. Show matches',
    );
    expect(screen.getByTestId('table-explain')).toHaveTextContent(s.table.explain.matches);
  });

  it('all sets: counts sets, 1 per set won, and shows draws in the record', async () => {
    const { cup, teams, play } = seedCup(['Rot', 'Blau', 'Grün'], {
      setsPerMatch: 2,
      matchEnd: 'allSets',
    });
    const [rot, blau, grun] = teams;
    play(0, 1, [
      [25, 20],
      [20, 25],
    ]); // draw
    play(0, 2, [
      [25, 20],
      [25, 20],
    ]); // Rot 2:0
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(order()).toEqual([rot.id, blau.id, grun.id]);
    expect([rot, blau, grun].map((x) => points(x.id).props.children)).toEqual([3, 1, 0]);
    const first = within(screen.getByTestId(`table-row-${rot.id}`));
    expect(first.getByText('1–1–0 ·')).toBeTruthy();
    expect(first.getByText(s.table.unit.sets)).toBeTruthy();
    expect(within(screen.getByTestId(`table-row-${grun.id}`)).getByText('0–0–1 ·')).toBeTruthy();
    expect(screen.getByTestId('table-explain')).toHaveTextContent(s.table.explain.sets);
  });

  it('teams equal in everything share a rank and are listed by name', async () => {
    const { cup, teams, play } = seedCup(['Zebras', 'Adler', 'Mitte', 'Biber'], {
      setsPerMatch: 1,
      matchEnd: 'bestOf',
    });
    const [zebras, adler, mitte, biber] = teams;
    play(0, 1, [[25, 20]]); // Zebras beat Adler
    play(2, 3, [[25, 20]]); // Mitte beat Biber, the same way
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(order()).toEqual([mitte.id, zebras.id, adler.id, biber.id]);
    expect([mitte, zebras, adler, biber].map((x) => rank(x.id).props.children)).toEqual([
      1, 1, 3, 3,
    ]);
  });

  it('before any result everyone is first, in name order', async () => {
    const { cup, teams } = seedCup(['Rivals', 'Adler']);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(order()).toEqual([teams[1].id, teams[0].id]);
    expect(teams.map((x) => rank(x.id).props.children)).toEqual([1, 1]);
  });

  it('follows a result that is entered', async () => {
    const { cup, teams, play } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    expect(points(teams[1].id).props.children).toBe(0);
    play(0, 1, [
      [20, 25],
      [20, 25],
    ]);
    await screen.findByText('balls +10');
    expect(order()).toEqual([teams[1].id, teams[0].id]);
    expect(points(teams[1].id).props.children).toBe(2);
  });

  it('tapping a row opens that team’s matches', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=table`);
    await fireEvent.press(screen.getByTestId(`table-row-${teams[1].id}`));
    expect(screen).toHavePathname(`/tournament/${cup.id}/team/${teams[1].id}`);
    expect(screen.getByTestId('hosted-team-title')).toHaveTextContent('Rivals');
  });
});

describe('a team’s matches', () => {
  it('shows its rank and numbers and every match in plan order', async () => {
    const { cup, teams, play } = seedCup(['TV Nord', 'Rivals', 'SC Blau', 'VBC Süd']);
    const [nord, rivals, blau, sud] = teams;
    play(0, 3, [
      [25, 20],
      [25, 22],
    ]);
    play(0, 2, [
      [20, 25],
      [25, 20],
      [10, 15],
    ]);
    await renderApp(`/tournament/${cup.id}/team/${nord.id}`);
    expect(screen.getByRole('header', { name: 'TV Nord' })).toBeTruthy();
    expect(screen.getByTestId('team-rank')).toHaveTextContent('2');
    expect(screen.getByTestId('team-points')).toHaveTextContent('2');
    expect(screen.getByTestId('team-played')).toHaveTextContent('2');
    expect(screen.getByTestId('team-record')).toHaveTextContent('1–1');
    expect(screen.getByTestId('team-sets')).toHaveTextContent('3:2');
    expect(screen.getByTestId('team-balls')).toHaveTextContent('+3');
    expect(screen.getByTestId('team-numbers').props.accessibilityLabel).toBe(
      'Rank 2, 2 played, record 1–1, sets 3:2, balls +3, 2 Matches',
    );
    // Round 1: Nord – Süd, round 2: Nord – Blau, round 3: Nord – Rivals.
    const rows = within(screen.getByTestId('team-matches')).getAllByTestId(/^team-match-/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      `team-match-${nord.id}-${sud.id}`,
      `team-match-${nord.id}-${blau.id}`,
      `team-match-${nord.id}-${rivals.id}`,
    ]);
    expect(rows[0].props.accessibilityLabel).toBe(
      'TV Nord – VBC Süd, 2:0 (25:20, 25:22). Change result',
    );
    expect(rows[2].props.accessibilityLabel).toBe('TV Nord – Rivals, not played yet. Enter result');
    expect(screen.getByText(s.matches.round(3))).toBeTruthy();
  });

  it('shows a team that is second in a pair the same way round as the plan', async () => {
    const { cup, teams, play } = seedCup(['TV Nord', 'Rivals']);
    play(0, 1, [
      [25, 20],
      [25, 22],
    ]);
    await renderApp(`/tournament/${cup.id}/team/${teams[1].id}`);
    expect(screen.getByTestId('team-rank')).toHaveTextContent('2');
    expect(screen.getByTestId('team-record')).toHaveTextContent('0–1');
    expect(screen.getByTestId('team-balls')).toHaveTextContent('−8');
    expect(
      screen.getByTestId(`team-match-${teams[0].id}-${teams[1].id}`).props.accessibilityLabel,
    ).toBe('TV Nord – Rivals, 2:0 (25:20, 25:22). Change result');
  });

  it('tapping a match opens its result', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}/team/${teams[0].id}`);
    await fireEvent.press(screen.getByTestId(`team-match-${teams[0].id}-${teams[1].id}`));
    expect(screen).toHavePathname(`/tournament/${cup.id}/match`);
    expect(screen.getByTestId('result-screen')).toBeTruthy();
  });

  it('says so when the team is the only one', async () => {
    const { cup, teams } = seedCup(['TV Nord']);
    await renderApp(`/tournament/${cup.id}/team/${teams[0].id}`);
    expect(screen.getByText(s.team.empty)).toBeTruthy();
    expect(screen.getByTestId('team-rank')).toHaveTextContent('1');
  });

  it('shows "not found" for an unknown team and for another profile’s tournament', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}/team/nobody`);
    expect(screen.getByText(s.team.notFound)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: s.team.back }));
    expect(screen).toHavePathname(`/tournament/${cup.id}`);

    const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
    const theirs = store().addHostedTournament({
      profileId: other.id,
      name: 'Theirs',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    await renderApp(`/tournament/${theirs.id}/team/${teams[0].id}`);
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
  });

  it('a team row on the Teams tab opens it too', async () => {
    const { cup, teams } = seedCup(['TV Nord', 'Rivals']);
    await renderApp(`/tournament/${cup.id}?tab=teams`);
    await fireEvent.press(screen.getByRole('button', { name: s.teams.open('Rivals') }));
    expect(screen).toHavePathname(`/tournament/${cup.id}/team/${teams[1].id}`);
  });
});
