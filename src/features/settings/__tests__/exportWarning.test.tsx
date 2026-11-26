/**
 * v10 (audit H6): two devices can each add a player with the same jersey number before they
 * sync. A backup made then is refused on import, so Settings → Export says which team and which
 * number before the user exports. It never blocks the export.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { parseImport } from '@/domain/exportSchema';
import type { Player } from '@/domain/types';
import { saveTextFile } from '@/lib/fileTransfer';
import { useAppStore } from '@/store';
import { makePlayer, PROFILE_ID, seedApp } from '@/test-utils';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

const mockSave = saveTextFile as jest.MockedFunction<typeof saveTextFile>;
const store = () => useAppStore.getState();

const DAMEN = 'team2';
/** A player of team "Damen". */
const damen = (number: number, id: string): Player =>
  makePlayer(number, 'Dana', ['OH'], { id, teamId: DAMEN });
/** A second "Herren 1" player with `number`, as another device added it before the sync. */
const twin = (number: number): Player =>
  makePlayer(number, 'Twin', ['OH'], { id: `twin${number}` });

const herren = [makePlayer(7, 'Sina', ['S']), makePlayer(12, 'Olga', ['OH'])];

/** Profile "Coach" with "Herren 1" (`team1`) and "Damen" (`team2`). */
function seed(players: Player[]) {
  seedApp({ players, language: 'en' });
  useAppStore.setState((s) => ({
    teams: [
      ...s.teams,
      { id: DAMEN, profileId: PROFILE_ID, name: 'Damen', createdAt: '2026-01-02' },
    ],
  }));
}

async function renderSettings() {
  await renderRouter(
    { index: () => <Text>Profile picker</Text>, settings: SettingsScreen },
    { initialUrl: '/settings' },
  );
}

const warning = () => screen.queryByTestId('export-duplicate-numbers');

beforeEach(() => jest.clearAllMocks());
afterAll(() => store().setLanguage('en'));

describe('export: duplicate jersey numbers', () => {
  it('shows no warning when no team has a number twice', async () => {
    // The same number in two teams is fine.
    seed([...herren, damen(7, 'd7')]);
    await renderSettings();
    expect(screen.getByTestId('export-all')).toBeTruthy();
    expect(warning()).toBeNull();
  });

  it('names the team and the number before anything is exported', async () => {
    seed([...herren, twin(7), damen(3, 'd3')]);
    await renderSettings();
    expect(warning()).toHaveTextContent(
      'A backup made now can’t be loaded again: Herren 1 has two players with number 7. Change one of the numbers first.',
    );
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('lists several teams and numbers', async () => {
    seed([...herren, twin(12), twin(7), damen(3, 'd3'), damen(3, 'd3b')]);
    await renderSettings();
    expect(warning()).toHaveTextContent(
      'A backup made now can’t be loaded again because players share a number: Herren 1 (7, 12), Damen (3). Give them different numbers first.',
    );
  });

  it('does not block the export (the file is the one the import refuses)', async () => {
    seed([...herren, twin(7)]);
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Export everything'));

    expect(mockSave).toHaveBeenCalledTimes(1);
    const [name, text] = mockSave.mock.calls[0];
    expect(await screen.findByText(`Exported ${name}.`)).toBeTruthy();
    expect(warning()).toBeTruthy();
    expect(parseImport(text)).toEqual({ ok: false, error: 'INCONSISTENT_REFERENCES' });
  });

  it('disappears once the number is changed, and the backup loads again', async () => {
    seed([...herren, twin(7)]);
    await renderSettings();
    expect(warning()).toBeTruthy();
    await act(async () => store().updatePlayer('twin7', { number: 8 }));
    expect(warning()).toBeNull();

    await fireEvent.press(screen.getByLabelText('Export everything'));
    expect(parseImport(mockSave.mock.calls[0][1]).ok).toBe(true);
  });

  it('is in German when the app is', async () => {
    seed([...herren, twin(7)]);
    store().setLanguage('de');
    await renderSettings();
    expect(warning()).toHaveTextContent(
      'Eine jetzt erstellte Sicherung lässt sich nicht wieder laden: Im Team Herren 1 haben zwei Spieler die Nummer 7. Ändere zuerst eine der beiden Nummern.',
    );
    await act(async () =>
      useAppStore.setState((s) => ({ players: [...s.players, damen(3, 'd3'), damen(3, 'd3b')] })),
    );
    expect(warning()).toHaveTextContent(
      'Eine jetzt erstellte Sicherung lässt sich nicht wieder laden, weil sich Spieler eine Nummer teilen: Herren 1 (7), Damen (3). Gib ihnen zuerst unterschiedliche Nummern.',
    );
  });
});
