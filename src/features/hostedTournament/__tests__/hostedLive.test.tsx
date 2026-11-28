/**
 * v12.2: live scoring of a tournament match — only the score, with optional point details.
 */
import { fireEvent, screen, within } from '@testing-library/react-native';

import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { resetStartupRedirect } from '@/features/roster/hooks/useStartupRedirect';
import { useAppStore } from '@/store';
import { renderApp, resetStores } from '@/test-utils';

const s = t.tournament.live;
const store = () => useAppStore.getState();

beforeEach(() => {
  resetStores();
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
});

/** "Winter Cup": Hosts (with players, shown by name) and TV Nord (no players), best of 3. */
function seed(
  extra: { plan?: 'roundRobin' | 'manual'; setsPerMatch?: 2 | 3; allSets?: boolean } = {},
) {
  const profile = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  store().selectProfile(profile.id);
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    setsPerMatch: extra.setsPerMatch ?? 3,
    matchEnd: extra.allSets ? 'allSets' : 'bestOf',
    plan: extra.plan ?? 'roundRobin',
  });
  const hosts = store().addHostedTeam(cup.id, 'Hosts');
  const nord = store().addHostedTeam(cup.id, 'TV Nord');
  store().setHostedPlayerLabel(hosts.id, 'name');
  const kelly = store().addHostedPlayer(hosts.id, { number: 6, name: 'Kelly' });
  const nine = store().addHostedPlayer(hosts.id, { number: 9 });
  const url = `/tournament/${cup.id}/live?a=${hosts.id}&b=${nord.id}`;
  return { cup, hosts, nord, kelly, nine, url };
}

const tap = (testID: string) => fireEvent.press(screen.getByTestId(testID));
/** Scores points in order: "aab" → Hosts, Hosts, TV Nord. */
const play = async (order: string) => {
  for (const team of order) await tap(`live-point-${team}`);
};
const score = () =>
  `${screen.getByTestId('live-score-a').props.children}:${screen.getByTestId('live-score-b').props.children}`;
const result = () => store().hostedResults[0];

describe('live scoring of a tournament match', () => {
  it('starts at 0:0 in set 1 with nothing to undo or end', async () => {
    const { url } = seed();
    await renderApp(url);
    expect(screen.getByRole('header', { name: s.title })).toBeTruthy();
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Winter Cup · Round 1 · best of 3',
    );
    expect(score()).toBe('0:0');
    expect(screen.getByTestId('live-set')).toHaveTextContent('Set 1');
    expect(screen.getByTestId('live-sets')).toHaveTextContent('Sets 0:0');
    expect(screen.getByTestId('live-undo')).toBeDisabled();
    expect(screen.getByTestId('live-end-set')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Point Hosts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Point TV Nord' })).toBeTruthy();
    expect(store().hostedResults).toEqual([]);
    // only the scoring: no court, no serve, no rotation
    expect(screen.queryByTestId('scoreboard')).toBeNull();
    expect(screen.queryByTestId('serve-text')).toBeNull();
    expect(screen.queryByTestId('rotation-text')).toBeNull();
  });

  it('counts point by point and stores every rally at once', async () => {
    const { url, hosts, nord } = seed();
    await renderApp(url);
    await play('aab');
    expect(score()).toBe('2:1');
    expect(result()).toMatchObject({
      teamAId: hosts.id,
      teamBId: nord.id,
      sets: [],
      live: [[{ team: 'a' }, { team: 'a' }, { team: 'b' }]],
    });
    expect(screen.getByTestId('live-board').props.accessibilityLabel).toBe(
      'Set 1: Hosts 2, TV Nord 1. Sets 0:0',
    );
  });

  it('"End set" ends a set of any length once the scores differ; the next point starts the next', async () => {
    const { url } = seed();
    await renderApp(url);
    await play('ab');
    expect(screen.getByTestId('live-end-set')).toBeDisabled();
    await play('a');
    expect(screen.getByRole('button', { name: 'End set 1' })).not.toBeDisabled();
    await tap('live-end-set');
    expect(result().sets).toEqual([{ a: 2, b: 1 }]);
    expect(screen.getByTestId('live-sets')).toHaveTextContent('Sets 1:0');
    expect(screen.getByTestId('live-set')).toHaveTextContent('Set 2');
    expect(score()).toBe('0:0');
    expect(screen.getByTestId('live-between')).toHaveTextContent(
      'Set 1 ended 2:1. The next point starts set 2.',
    );
    await play('b');
    expect(score()).toBe('0:1');
    expect(screen.queryByTestId('live-between')).toBeNull();
    expect(result().live).toHaveLength(2);
  });

  it('the match is over by the tournament’s format; then there are no point buttons', async () => {
    const { url } = seed();
    await renderApp(url);
    await play('a');
    await tap('live-end-set');
    await play('aa');
    await tap('live-end-set');
    expect(screen.getByTestId('live-over')).toHaveTextContent('Hosts wins 2:0');
    expect(screen.queryByTestId('live-point-a')).toBeNull();
    expect(screen.queryByTestId('live-end-set')).toBeNull();
    expect(result().sets).toEqual([
      { a: 1, b: 0 },
      { a: 2, b: 0 },
    ]);
    await tap('live-done');
    expect(screen).toHavePathname(`/tournament/${result().tournamentId}/match`);
  });

  it('says who won when it is the second team, and a draw when all sets are played', async () => {
    const { url } = seed({ setsPerMatch: 2, allSets: true });
    await renderApp(url);
    await play('b');
    await tap('live-end-set');
    await play('a');
    await tap('live-end-set');
    expect(screen.getByTestId('live-over')).toHaveTextContent('Draw 1:1');
    await tap('live-undo');
    await play('bb');
    await tap('live-end-set');
    expect(screen.getByTestId('live-over')).toHaveTextContent('TV Nord wins 2:0');
  });

  it('Undo takes back a rally, then re-opens the set that ended; back to nothing leaves no result', async () => {
    const { url } = seed();
    await renderApp(url);
    await play('aab');
    await tap('live-end-set');
    // between sets: undo plays set 1 on
    expect(screen.getByTestId('live-undo').props.accessibilityLabel).toBe('Undo: play set 1 on');
    await tap('live-undo');
    expect(score()).toBe('2:1');
    expect(result().sets).toEqual([]);
    expect(screen.getByTestId('live-undo').props.accessibilityLabel).toBe('Undo the last point');
    await tap('live-undo');
    await tap('live-undo');
    expect(score()).toBe('1:0');
    await tap('live-undo');
    expect(score()).toBe('0:0');
    expect(store().hostedResults).toEqual([]);
    expect(screen.getByTestId('live-undo')).toBeDisabled();
  });

  it('carries on from typed-in sets, which it can’t re-open', async () => {
    const { cup, hosts, nord, url } = seed();
    store().setHostedResult(cup.id, hosts.id, nord.id, [{ a: 25, b: 20 }]);
    await renderApp(url);
    expect(screen.getByTestId('live-set')).toHaveTextContent('Set 2');
    expect(screen.getByTestId('live-sets')).toHaveTextContent('Sets 1:0');
    expect(screen.getByTestId('live-undo')).toBeDisabled();
    await play('b');
    expect(result()).toMatchObject({ sets: [{ a: 25, b: 20 }], live: [[], [{ team: 'b' }]] });
    await tap('live-undo');
    expect(result()).toEqual({
      id: result().id,
      tournamentId: cup.id,
      teamAId: hosts.id,
      teamBId: nord.id,
      sets: [{ a: 25, b: 20 }],
    });
  });

  it('scores an added match by its id', async () => {
    const { cup, hosts, nord } = seed({ plan: 'manual' });
    const first = store().addHostedMatch(cup.id, nord.id, hosts.id);
    const second = store().addHostedMatch(cup.id, nord.id, hosts.id);
    if (!first || !second) throw new Error('seed');
    await renderApp(`/tournament/${cup.id}/live?m=${second.id}`);
    expect(screen.getByTestId('header-subtitle')).toHaveTextContent(
      'Winter Cup · Match 2 · best of 3',
    );
    // the team chosen first is the left one
    expect(screen.getByRole('button', { name: 'Point TV Nord' })).toBe(
      screen.getByTestId('live-point-a'),
    );
    await play('ab');
    expect(store().hostedResults[0]).toEqual(first);
    expect(store().hostedResults[1].live).toEqual([[{ team: 'a' }, { team: 'b' }]]);
  });

  it('shows "not found" for a match that is not in the plan', async () => {
    const { cup, hosts } = seed();
    await renderApp(`/tournament/${cup.id}/live?a=${hosts.id}&b=nobody`);
    expect(screen.getByText(s.notFound)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.tournament.team.back }));
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
    await renderApp('/tournament/nope/live?a=x&b=y');
    expect(screen.getByText(t.tournament.form.notFound)).toBeTruthy();
  });
});

describe('the questions after a point', () => {
  it('a team without players is asked only how the point was won', async () => {
    const { url } = seed();
    await renderApp(url);
    expect(screen.queryByTestId('live-tags')).toBeNull();
    await play('b'); // TV Nord has no players
    expect(screen.getByText(s.tag.label)).toBeTruthy();
    await tap('live-tag-block');
    expect(result().live).toEqual([[{ team: 'b', kind: 'block' }]]);
    expect(screen.queryByTestId('live-tag-who')).toBeNull();
    expect(screen.getByTestId('live-tag-block').props.accessibilityState.selected).toBe(true);
    // tapping it again takes the answer back
    await tap('live-tag-block');
    expect(result().live).toEqual([[{ team: 'b' }]]);
  });

  it('a team with players is then asked who, by what the team goes by', async () => {
    const { url, kelly, nine } = seed();
    await renderApp(url);
    await play('a');
    await tap('live-tag-ace');
    expect(screen.getByTestId('live-tag-who')).toHaveTextContent('Optional: who? (Ace, Hosts)');
    // Hosts go by name: "Kelly"; the player without a name keeps the number
    const kellyChip = screen.getByTestId(`live-tag-player-${kelly.id}`);
    expect(within(kellyChip).getByText('Kelly')).toBeTruthy();
    expect(kellyChip.props.accessibilityLabel).toBe('Kelly: #6 Kelly');
    expect(within(screen.getByTestId(`live-tag-player-${nine.id}`)).getByText('#9')).toBeTruthy();
    await fireEvent.press(kellyChip);
    expect(result().live).toEqual([[{ team: 'a', kind: 'ace', playerId: kelly.id }]]);
    // tapping the chosen player again leaves the kind
    await fireEvent.press(screen.getByTestId(`live-tag-player-${kelly.id}`));
    expect(result().live).toEqual([[{ team: 'a', kind: 'ace' }]]);
    // another kind drops the player
    await fireEvent.press(screen.getByTestId(`live-tag-player-${nine.id}`));
    await tap('live-tag-attack');
    expect(result().live).toEqual([[{ team: 'a', kind: 'attack' }]]);
  });

  it('an opponent’s error asks for a player of the team that made it', async () => {
    const { url, kelly } = seed();
    await renderApp(url);
    await play('b'); // TV Nord scores …
    await tap('live-tag-error'); // … by an error of Hosts
    expect(screen.getByTestId('live-tag-who')).toHaveTextContent('Optional: whose error? (Hosts)');
    await tap(`live-tag-player-${kelly.id}`);
    expect(result().live).toEqual([[{ team: 'b', kind: 'error', playerId: kelly.id }]]);
    // the other way round: Hosts score by an error of TV Nord, who have no players
    await play('a');
    await tap('live-tag-error');
    expect(screen.queryByTestId('live-tag-who')).toBeNull();
  });

  it('are closed with ✕, by Undo and by "End set", and come back with the next point', async () => {
    const { url } = seed();
    await renderApp(url);
    await play('a');
    await tap('live-tag-close');
    expect(screen.queryByTestId('live-tags')).toBeNull();
    await play('a');
    expect(screen.getByTestId('live-tags')).toBeTruthy();
    await tap('live-undo');
    expect(screen.queryByTestId('live-tags')).toBeNull();
    await play('a');
    await tap('live-end-set');
    expect(screen.queryByTestId('live-tags')).toBeNull();
  });

  it('add up under the score: per team, and per player that was named', async () => {
    const { url, kelly } = seed();
    await renderApp(url);
    expect(screen.getByText(s.stats.none)).toBeTruthy();
    for (let i = 0; i < 4; i += 1) {
      await play('b');
      await tap('live-tag-block');
    }
    await play('a');
    await tap('live-tag-ace');
    await tap(`live-tag-player-${kelly.id}`);
    await play('a');
    await tap('live-tag-error'); // an error of TV Nord
    expect(screen.queryByText(s.stats.none)).toBeNull();
    const stats = within(screen.getByTestId('live-stats'));
    // "TV Nord blocked 4 times" (and made one error); "Kelly scored an ace"
    expect(stats.getByTestId('live-stats-side-0').props.accessibilityLabel).toBe('Hosts: 1 ace');
    expect(stats.getByTestId('live-stats-side-1').props.accessibilityLabel).toBe(
      'TV Nord: 4 blocks · 1 error',
    );
    expect(stats.getByTestId(`live-stats-player-${kelly.id}`)).toHaveTextContent('Kelly: 1 ace');
  });
});

describe('a live-scored match elsewhere', () => {
  async function scored() {
    const ids = seed();
    await renderApp(ids.url);
    await play('aab');
    await tap('live-tag-attack');
    await tap('live-end-set');
    await play('b');
    return ids;
  }

  it('the result screen has "Live" in the header', async () => {
    const { cup, hosts, nord } = seed();
    await renderApp(`/tournament/${cup.id}/match?a=${hosts.id}&b=${nord.id}`);
    await fireEvent.press(screen.getByRole('button', { name: s.openLabel }));
    expect(screen).toHavePathname(`/tournament/${cup.id}/live`);
    expect(screen.getByTestId('tournament-live-screen')).toBeTruthy();
  });

  it('the result screen shows the counted sets locked, with the details below', async () => {
    const { cup, hosts, nord } = await scored();
    await renderApp(`/tournament/${cup.id}/match?a=${hosts.id}&b=${nord.id}`);
    expect(within(screen.getByTestId('result-live-locked')).getByText(s.locked)).toBeTruthy();
    expect(screen.getByTestId('result-set-1-a').props.value).toBe('2');
    expect(screen.getByTestId('result-set-1-a').props.editable).toBe(false);
    expect(screen.queryByTestId('result-set-2')).toBeNull();
    expect(screen.queryByTestId('result-save')).toBeNull();
    expect(screen.getByTestId('live-stats-side-0').props.accessibilityLabel).toBe(
      'TV Nord: 1 attack point',
    );
  });

  it('"Delete live details" asks, keeps the sets and frees the form', async () => {
    const { cup, hosts, nord } = await scored();
    await renderApp(`/tournament/${cup.id}/match?a=${hosts.id}&b=${nord.id}`);
    await tap('result-delete-live');
    expect(screen.getByText(s.confirmDeleteLive)).toBeTruthy();
    await tap('confirm');
    expect(result()).toEqual({
      id: result().id,
      tournamentId: cup.id,
      teamAId: hosts.id,
      teamBId: nord.id,
      sets: [{ a: 2, b: 1 }],
    });
    expect(screen.queryByTestId('result-live-locked')).toBeNull();
    expect(screen.getByTestId('result-set-1-a').props.editable).not.toBe(false);
    expect(screen.getByTestId('result-save')).toBeTruthy();
    expect(screen.queryByTestId('live-stats')).toBeNull();
  });

  it('the Matches tab shows the running set and says so', async () => {
    const { cup, hosts, nord } = await scored();
    await renderApp(`/tournament/${cup.id}?tab=matches`);
    const row = screen.getByTestId(`plan-match-${hosts.id}-${nord.id}`);
    expect(row.props.accessibilityLabel).toBe(
      'Hosts – TV Nord, 1:0, set 2 running 0:1. Open result',
    );
    expect(within(row).getByTestId('match-running')).toBeTruthy();
    expect(screen.getByTestId('plan-played')).toHaveTextContent('0 of 1 played');
  });

  it('a team’s screen adds its details up over the tournament', async () => {
    const { cup, nord, hosts } = await scored();
    await renderApp(`/tournament/${cup.id}/team/${nord.id}`);
    expect(screen.getByTestId('live-stats-side-0').props.accessibilityLabel).toBe(
      'TV Nord: 1 attack point',
    );
    // a team without any detail has no panel
    await renderApp(`/tournament/${cup.id}/team/${hosts.id}`);
    expect(screen.queryByTestId('live-stats')).toBeNull();
  });

  it('is in German when the language is German', async () => {
    const { url } = seed();
    useAppStore.setState({ language: 'de' });
    await renderApp(url);
    expect(screen.getByRole('button', { name: 'Punkt Hosts' })).toBeTruthy();
    await play('a');
    expect(screen.getByText(de.tournament.live.tag.label)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Satz 1 beenden' })).toBeTruthy();
    await tap('live-tag-ace');
    expect(screen.getByTestId('live-stats-side-0').props.accessibilityLabel).toBe('Hosts: 1 Ass');
  });
});
