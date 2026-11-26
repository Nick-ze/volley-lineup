/**
 * v10 (audit H6): two devices can each add a player with the same jersey number before they
 * sync. Both players stay, but a backup of that team is refused on import, so the roster tab
 * says so, to managers and view-only members alike, until one of the numbers is changed.
 */
import { act, screen } from '@testing-library/react-native';

import type { Player } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { useAppStore, type Language } from '@/store';
import { makePlayer, renderApp, seedApp } from '@/test-utils';

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
afterAll(() => {
  jest.restoreAllMocks();
  useAppStore.getState().setLanguage('en');
});

const sina = makePlayer(7, 'Sina', ['S']);
const olga = makePlayer(3, 'Olga', ['OH']);
const mia = makePlayer(12, 'Mia', ['MB']);
/** A second player with `number`, as another device added it before the sync. */
const twin = (number: number): Player =>
  makePlayer(number, 'Twin', ['OH'], { id: `twin${number}` });

async function renderRoster(players: Player[], language: Language = 'en') {
  seedApp({ players, language });
  await renderApp('/team/team1?tab=roster');
}

/** A view-only member (player role) of the shared team. */
function makeViewer() {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'prof1' },
      teams: {
        team1: { userId: 'u1', role: 'player', cursor: 0, base: {}, edits: {}, photos: [] },
      },
    },
  });
}

const warning = () => screen.queryByTestId('roster-duplicate-numbers');

describe('roster: duplicate jersey numbers', () => {
  it('shows no warning when every number is used once', async () => {
    await renderRoster([sina, olga, mia]);
    expect(screen.getByTestId('roster-grid')).toBeTruthy();
    expect(warning()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names the number two players share', async () => {
    await renderRoster([sina, olga, twin(7)]);
    expect(warning()).toHaveTextContent(
      "Two players have number 7. Give one of them another number: until then a backup of this team can't be loaded.",
    );
    expect(screen.getByRole('alert')).toHaveTextContent(t.roster.roster.duplicateNumbers([7]));
    // Both players are still on the roster.
    expect(screen.getByText(t.roster.team.playerCount(3))).toBeTruthy();
  });

  it('lists several shared numbers, ascending', async () => {
    await renderRoster([mia, sina, olga, twin(12), twin(7)]);
    expect(warning()).toHaveTextContent(
      "Several players share a number (7, 12). Give them different numbers: until then a backup of this team can't be loaded.",
    );
  });

  it('ignores the same number in another team', async () => {
    await renderRoster([sina, olga, makePlayer(7, 'Other', ['S'], { id: 'x7', teamId: 'team2' })]);
    expect(warning()).toBeNull();
  });

  it('disappears as soon as one of the numbers is changed', async () => {
    await renderRoster([sina, olga, twin(7)]);
    expect(warning()).toBeTruthy();
    await act(async () => useAppStore.getState().updatePlayer('twin7', { number: 8 }));
    expect(warning()).toBeNull();
  });

  it('is shown to a view-only member too', async () => {
    seedApp({ players: [sina, olga, twin(7)], language: 'en' });
    makeViewer();
    await renderApp('/team/team1?tab=roster');
    expect(screen.getByText(t.sync.readOnly.viewer)).toBeTruthy();
    expect(warning()).toHaveTextContent(t.roster.roster.duplicateNumbers([7]));
  });

  it('is in German when the app is', async () => {
    await renderRoster([sina, olga, twin(7)], 'de');
    expect(warning()).toHaveTextContent(
      'Zwei Spieler haben die Nummer 7. Gib einem der beiden eine andere Nummer: Bis dahin lässt sich eine Sicherung dieses Teams nicht laden.',
    );
    await act(async () =>
      useAppStore.setState((s) => ({ players: [...s.players, mia, twin(12)] })),
    );
    expect(warning()).toHaveTextContent(de.roster.roster.duplicateNumbers([7, 12]));
    expect(de.roster.roster.duplicateNumbers([7, 12])).toBe(
      'Mehrere Spieler teilen sich eine Nummer (7, 12). Gib ihnen unterschiedliche Nummern: Bis dahin lässt sich eine Sicherung dieses Teams nicht laden.',
    );
  });
});
