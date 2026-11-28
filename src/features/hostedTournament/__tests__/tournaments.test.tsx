/**
 * v12 PR 2: the Tournaments tab (list, create, edit, delete) and the tournament form.
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
  // The language is a device setting: "Delete all data" keeps it.
  useAppStore.setState({ language: 'en' });
  resetStartupRedirect();
});

function seedProfile() {
  const profile = store().addProfile({ name: 'Coach Müller', color: '#FF6B00' });
  store().selectProfile(profile.id);
  return profile;
}

/** "Winter Cup": three teams, best of 3, one finished and one running match. */
function seedCup() {
  const profile = seedProfile();
  const cup = store().addHostedTournament({
    profileId: profile.id,
    name: 'Winter Cup',
    date: '2026-12-05',
    location: 'Halle Süd',
    setsPerMatch: 3,
    matchEnd: 'bestOf',
  });
  const [a, b, c] = ['TV Nord', 'Rivals', 'SC Blau'].map((name) =>
    store().addHostedTeam(cup.id, name),
  );
  store().setHostedResult(cup.id, a.id, b.id, [
    { a: 25, b: 20 },
    { a: 20, b: 25 },
    { a: 15, b: 12 },
  ]);
  store().setHostedResult(cup.id, a.id, c.id, [{ a: 25, b: 20 }]);
  return { profile, cup, a, b, c };
}

const type = (testID: string, text: string) =>
  fireEvent.changeText(screen.getByTestId(testID), text);
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
const checked = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.checked;

describe('Tournaments tab', () => {
  it('is the second of four tabs and shows the profile’s name above the title', async () => {
    seedProfile();
    await renderApp('/tournaments');
    expect(screen.getByRole('header', { name: s.nav.tournaments })).toBeTruthy();
    expect(screen.getByText('Coach Müller')).toBeTruthy();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel);
    expect(tabs).toEqual([
      t.profile.tabs.teamsLabel,
      s.tab.accessibilityLabel,
      t.profile.tabs.profileLabel,
      t.profile.tabs.settingsLabel,
    ]);
    expect(screen.getByTestId('tab-tournaments').props.accessibilityState?.selected).toBe(true);
  });

  it('without a profile goes to the profile picker', async () => {
    await renderApp('/tournaments');
    expect(screen).toHavePathname('/');
  });

  it('shows the empty sentence, the one main action and where a team’s own tournament goes', async () => {
    seedProfile();
    await renderApp('/tournaments');
    expect(screen.getByTestId('tournaments-empty')).toHaveTextContent(s.list.empty);
    expect(screen.getByRole('button', { name: s.list.new })).toBeTruthy();
    expect(screen.getByText(s.list.ownTeamHint)).toBeTruthy();
  });

  it('lists only the profile’s tournaments with teams, played matches and the date', async () => {
    const { cup } = seedCup();
    const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
    store().addHostedTournament({
      profileId: other.id,
      name: 'Not mine',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    await renderApp('/tournaments');
    expect(screen.queryByTestId('tournaments-empty')).toBeNull();
    expect(screen.getByText('Winter Cup')).toBeTruthy();
    expect(screen.queryByText('Not mine')).toBeNull();
    // One of the three matches is over; the running one doesn't count as played.
    const summary = within(screen.getByTestId(`tournament-${cup.id}-summary`));
    expect(summary.getByText('3 teams ·')).toBeTruthy();
    expect(summary.getByText('1 of 3 played')).toBeTruthy();
    expect(screen.getByText('05.12.26')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Winter Cup, 3 teams · 1 of 3 played. Open' }),
    ).toBeTruthy();
  });

  it('gives a long name two lines before it is cut', async () => {
    seedCup();
    await renderApp('/tournaments');
    expect(screen.getByText('Winter Cup').props.numberOfLines).toBe(2);
  });

  it('opens a tournament', async () => {
    const { cup } = seedCup();
    await renderApp('/tournaments');
    await fireEvent.press(screen.getByTestId(`tournament-${cup.id}`));
    expect(screen).toHavePathname(`/tournament/${cup.id}`);
    expect(screen.getByTestId('tournament-name')).toHaveTextContent('Winter Cup');
    expect(screen.getByTestId('tournament-meta')).toHaveTextContent(
      '05.12.26 · Halle Süd · best of 3',
    );
  });

  it('deletes a tournament only after the confirmation, which says what goes', async () => {
    const { cup } = seedCup();
    await renderApp('/tournaments');
    await press(s.list.deleteLabel('Winter Cup'));
    expect(
      screen.getByText('Delete tournament “Winter Cup” with its 3 teams and 2 results?'),
    ).toBeTruthy();
    await press(t.common.cancel);
    expect(store().hostedTournaments).toHaveLength(1);

    await press(s.list.deleteLabel('Winter Cup'));
    await fireEvent.press(screen.getByTestId('confirm'));
    expect(store().hostedTournaments).toEqual([]);
    expect(store().hostedTeams).toEqual([]);
    expect(store().hostedResults).toEqual([]);
    expect(screen.queryByTestId(`tournament-${cup.id}`)).toBeNull();
    expect(screen.getByTestId('tournaments-empty')).toBeTruthy();
  });

  it('asks without numbers for a tournament without teams', async () => {
    const profile = seedProfile();
    store().addHostedTournament({
      profileId: profile.id,
      name: 'Empty',
      setsPerMatch: 1,
      matchEnd: 'bestOf',
    });
    await renderApp('/tournaments');
    await press(s.list.deleteLabel('Empty'));
    expect(screen.getByText('Delete tournament “Empty”?')).toBeTruthy();
  });

  it('is in German when the language is German', async () => {
    seedCup();
    useAppStore.setState({ language: 'de' });
    await renderApp('/tournaments');
    expect(screen.getByRole('header', { name: 'Turniere' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neues Turnier' })).toBeTruthy();
    expect(screen.getByText('3 Teams ·')).toBeTruthy();
    expect(screen.getByText('1 von 3 gespielt')).toBeTruthy();
    expect(screen.getByText(de.tournament.list.ownTeamHint)).toBeTruthy();
  });
});

describe('tournament form', () => {
  it('creates a tournament with the defaults (3 sets, best of 3) and opens it', async () => {
    const profile = seedProfile();
    await renderApp('/tournaments');
    await press(s.list.new);
    expect(screen).toHavePathname('/tournament-new');
    expect(checked('tournament-sets-3')).toBe(true);
    expect(checked('tournament-end-bestOf')).toBe(true);
    expect(screen.getByTestId('tournament-counts')).toHaveTextContent(s.form.counts.matches);

    await type('tournament-name', '  Sommer-Cup ');
    await type('tournament-date', '5.7.27');
    await type('tournament-location', 'Beach');
    await press(s.form.create);

    expect(store().hostedTournaments).toHaveLength(1);
    const created = store().hostedTournaments[0];
    expect(created).toMatchObject({
      profileId: profile.id,
      name: 'Sommer-Cup',
      date: '2027-07-05',
      location: 'Beach',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    expect(screen).toHavePathname(`/tournament/${created.id}`);
  });

  it('offers "best of" only for 1, 3 and 5 sets and says what the table counts', async () => {
    seedProfile();
    await renderApp('/tournament-new');
    for (const n of [1, 2, 3, 4, 5] as const) {
      await fireEvent.press(screen.getByTestId(`tournament-sets-${n}`));
      expect(checked(`tournament-sets-${n}`)).toBe(true);
      if (n % 2 === 1) {
        expect(screen.getByTestId('tournament-end-bestOf')).toHaveTextContent(`Best of ${n}`);
        expect(screen.getByTestId('tournament-end-allSets')).toBeTruthy();
        expect(checked('tournament-end-bestOf')).toBe(true);
        expect(screen.getByTestId('tournament-counts')).toHaveTextContent(s.form.counts.matches);
      } else {
        expect(screen.queryByTestId('tournament-end-bestOf')).toBeNull();
        expect(checked('tournament-end-allSets')).toBe(true);
        expect(screen.getByTestId('tournament-counts')).toHaveTextContent(
          `${s.form.onlyAllSets(n)} ${s.form.counts.sets}`,
        );
      }
    }
    // "All sets" chosen for 5 says the table counts sets.
    await fireEvent.press(screen.getByTestId('tournament-end-allSets'));
    expect(screen.getByTestId('tournament-counts')).toHaveTextContent(s.form.counts.sets);
    // … and stays chosen through 4 and back to 3.
    await fireEvent.press(screen.getByTestId('tournament-sets-4'));
    await fireEvent.press(screen.getByTestId('tournament-sets-3'));
    expect(checked('tournament-end-allSets')).toBe(true);
  });

  it('saves 2 sets as "all sets are played"', async () => {
    seedProfile();
    await renderApp('/tournament-new');
    await type('tournament-name', 'Mixed');
    await fireEvent.press(screen.getByTestId('tournament-sets-2'));
    await press(s.form.create);
    expect(store().hostedTournaments[0]).toMatchObject({ setsPerMatch: 2, matchEnd: 'allSets' });
    expect(store().hostedTournaments[0]).not.toHaveProperty('date');
    expect(store().hostedTournaments[0]).not.toHaveProperty('location');
  });

  it('shows the errors and saves nothing', async () => {
    seedCup();
    await renderApp('/tournament-new');
    await press(s.form.create);
    expect(screen.getByText(s.errors.required)).toBeTruthy();
    await type('tournament-name', 'winter cup');
    await type('tournament-date', '31.2.26');
    await press(s.form.create);
    expect(screen.getByText(s.errors.duplicateTournament)).toBeTruthy();
    expect(screen.getByText(s.errors.invalidDate)).toBeTruthy();
    expect(store().hostedTournaments).toHaveLength(1);
    expect(screen).toHavePathname('/tournament-new');
  });

  it('Cancel changes nothing', async () => {
    seedProfile();
    await renderApp('/tournament-new');
    await type('tournament-name', 'Nope');
    await press(t.common.cancel);
    expect(store().hostedTournaments).toEqual([]);
    expect(screen).toHavePathname('/tournaments');
  });

  it('edits name, date, place and settings', async () => {
    const { cup } = seedCup();
    // No results in the way.
    useAppStore.setState({ hostedResults: [] });
    await renderApp('/tournaments');
    await press(s.list.editLabel('Winter Cup'));
    expect(screen).toHavePathname('/tournament-new');
    expect(screen.getByTestId('tournament-name').props.value).toBe('Winter Cup');
    expect(screen.getByTestId('tournament-date').props.value).toBe('05.12.26');
    expect(screen.getByTestId('tournament-location').props.value).toBe('Halle Süd');

    await type('tournament-name', 'Winter Cup 2');
    await type('tournament-date', '');
    await type('tournament-location', '');
    await fireEvent.press(screen.getByTestId('tournament-sets-4'));
    await press(t.common.save);
    expect(store().hostedTournaments).toEqual([
      {
        id: cup.id,
        profileId: cup.profileId,
        createdAt: cup.createdAt,
        name: 'Winter Cup 2',
        setsPerMatch: 4,
        matchEnd: 'allSets',
        plan: 'roundRobin',
      },
    ]);
    expect(store().hostedTeams).toHaveLength(3);
  });

  it('refuses fewer sets than a result has and names the match', async () => {
    const { cup } = seedCup();
    await renderApp(`/tournament-new?tournamentId=${cup.id}`);
    await fireEvent.press(screen.getByTestId('tournament-sets-2'));
    await press(t.common.save);
    expect(screen.getByTestId('tournament-blocked')).toHaveTextContent(
      'TV Nord – Rivals has a result with 3 sets. Change that result first.',
    );
    expect(store().hostedTournaments[0]).toMatchObject({ setsPerMatch: 3, matchEnd: 'bestOf' });
    // Choosing something else takes the notice away; a change that fits is saved.
    await fireEvent.press(screen.getByTestId('tournament-sets-5'));
    expect(screen.queryByTestId('tournament-blocked')).toBeNull();
    await press(t.common.save);
    expect(store().hostedTournaments[0]).toMatchObject({ setsPerMatch: 5, matchEnd: 'bestOf' });
  });

  it('refuses "best of" when a result has a set after the deciding one', async () => {
    const { cup, a, b } = seedCup();
    store().updateHostedTournament(cup.id, {
      name: cup.name,
      setsPerMatch: 3,
      matchEnd: 'allSets',
    });
    store().setHostedResult(cup.id, a.id, b.id, [
      { a: 25, b: 20 },
      { a: 25, b: 20 },
      { a: 20, b: 25 },
    ]);
    await renderApp(`/tournament-new?tournamentId=${cup.id}`);
    expect(checked('tournament-end-allSets')).toBe(true);
    await fireEvent.press(screen.getByTestId('tournament-end-bestOf'));
    await press(t.common.save);
    expect(screen.getByTestId('tournament-blocked')).toHaveTextContent(
      s.form.blocked.SET_AFTER_DECIDED('TV Nord', 'Rivals'),
    );
    expect(store().hostedTournaments[0].matchEnd).toBe('allSets');
  });

  it('does not edit an unknown tournament or another profile’s', async () => {
    seedCup();
    const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
    const theirs = store().addHostedTournament({
      profileId: other.id,
      name: 'Theirs',
      setsPerMatch: 3,
      matchEnd: 'bestOf',
    });
    await renderApp(`/tournament-new?tournamentId=${theirs.id}`);
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
    await press(s.form.back);
    expect(screen).toHavePathname('/tournaments');
  });
});

describe('tournament screen', () => {
  it('shows "not found" for an unknown tournament', async () => {
    seedProfile();
    await renderApp('/tournament/nope');
    expect(screen.getByText(s.form.notFound)).toBeTruthy();
  });

  it('Edit opens the form for this tournament', async () => {
    const { cup } = seedCup();
    await renderApp(`/tournament/${cup.id}`);
    await press(s.screen.editLabel('Winter Cup'));
    expect(screen).toHavePathname('/tournament-new');
    expect(screen.getByTestId('tournament-name').props.value).toBe('Winter Cup');
  });

  it('names the format of an all-sets tournament by its sets', async () => {
    const profile = seedProfile();
    const mixed = store().addHostedTournament({
      profileId: profile.id,
      name: 'Mixed',
      setsPerMatch: 2,
      matchEnd: 'allSets',
    });
    await renderApp(`/tournament/${mixed.id}`);
    expect(screen.getByTestId('tournament-meta')).toHaveTextContent('2 sets');
  });
});
