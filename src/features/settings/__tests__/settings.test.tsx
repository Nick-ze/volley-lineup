import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { buildExport, parseImport, serializeExport } from '@/domain/exportSchema';
import { pickTextFile, saveTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore, type AppData } from '@/store';

import { SettingsScreen } from '../SettingsScreen';
import { seasonRefs } from '@/test-utils/seasonRefs';

jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

const mockPick = pickTextFile as jest.MockedFunction<typeof pickTextFile>;
const mockSave = saveTextFile as jest.MockedFunction<typeof saveTextFile>;
const store = () => useAppStore.getState();

/** Two profiles; "Coach" (current) has two teams with players and a match. */
function seed() {
  const coach = store().addProfile({ name: 'Coach', color: '#FF6B00' });
  const other = store().addProfile({ name: 'Other', color: '#3D8BFF' });
  const herren = store().addTeam({ profileId: coach.id, name: 'Herren 1', season: '2026/27' });
  store().addTeam({ profileId: coach.id, name: 'Damen 2' });
  store().addTeam({ profileId: other.id, name: 'Mixed' });
  const p = store().addPlayer({
    teamId: herren.id,
    firstName: 'Ana',
    lastName: 'Ace',
    number: 7,
    positions: ['S'],
    active: true,
  });
  const match = store().addMatch({
    teamId: herren.id,
    ...seasonRefs(herren.id, 'Rivals'),
    opponent: 'Rivals',
    date: '2026-11-01',
    home: true,
  });
  store().setLineup(match.id, { ...match.sets[0], slots: { ...match.sets[0].slots, 1: p.id } });
  store().selectProfile(coach.id);
  return { coach, herren };
}

/** Separate data set used as the file being imported. */
function otherData(): AppData {
  return {
    profiles: [
      { id: 'x-pr', name: 'Imported', color: '#2ECC71', createdAt: '2026-01-01T00:00:00Z' },
    ],
    teams: [
      { id: 'x-t', profileId: 'x-pr', name: 'Imported team', createdAt: '2026-01-01T00:00:00Z' },
    ],
    players: [1, 2, 3].map((n) => ({
      id: `x-p${n}`,
      teamId: 'x-t',
      firstName: 'P',
      lastName: `${n}`,
      number: n,
      positions: ['OH' as const],
      active: true,
    })),
    matches: [],
    presets: [],
    seasons: [],
    opponents: [],
  };
}

const fileText = (data: AppData) =>
  serializeExport(buildExport({ ...data, photos: [] }, { now: new Date('2026-11-21T12:00:00Z') }));

async function renderSettings() {
  await renderRouter(
    { index: () => <Text>Profile picker</Text>, settings: SettingsScreen },
    { initialUrl: '/settings' },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  store().resetAll();
  useAppStore.setState({ hydrated: true });
});

describe('import', () => {
  it('previews the file and replaces all data', async () => {
    seed();
    mockPick.mockResolvedValue({ name: 'backup.json', text: fileText(otherData()) });
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Import from file'));
    expect(
      await screen.findByText(
        '1 team, 3 players, 0 matches, 0 seasons / tournaments, 0 saved lineups, 1 profile',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Ready to import backup.json')).toBeTruthy();
    // v8: the export day as dd.mm.yy (the file keeps the ISO timestamp).
    expect(screen.getByTestId('import-exported-on')).toHaveTextContent('Exported on 21.11.26');

    await fireEvent.press(screen.getByLabelText('Replace'));
    expect(selectAppData(store())).toEqual(otherData());
    expect(store().currentProfileId).toBe('x-pr'); // old profile gone; the only one is selected
    expect(screen.getByText('Import complete: data replaced.')).toBeTruthy();
    expect(screen.queryByTestId('import-preview')).toBeNull();
  });

  it('merges the file into the existing data', async () => {
    seed();
    const before = selectAppData(store());
    mockPick.mockResolvedValue({ name: 'team.json', text: fileText(otherData()) });
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Import from file'));
    await fireEvent.press(await screen.findByLabelText('Merge'));
    const after = selectAppData(store());
    expect(after.profiles).toEqual([...before.profiles, ...otherData().profiles]);
    expect(after.players).toHaveLength(before.players.length + 3);
    expect(store().currentProfileId).toBe(before.profiles[0].id);
    expect(screen.getByText('Import complete: data merged.')).toBeTruthy();
  });

  it.each([
    ['a foreign JSON file', '{"foo":1}', 'This file is not a Volley Lineup export.'],
    ['broken JSON', '{"app": "volley-lineup",', 'This file is not valid JSON.'],
    [
      'a newer schema version',
      JSON.stringify({ app: 'volley-lineup', schemaVersion: 11 }),
      'different version',
    ],
  ])('shows an error for %s and changes nothing', async (_label, text, message) => {
    seed();
    const before = JSON.stringify(store());
    mockPick.mockResolvedValue({ name: 'bad.json', text });
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Import from file'));
    expect(await screen.findByText(new RegExp(message))).toBeTruthy();
    expect(screen.queryByTestId('import-preview')).toBeNull();
    expect(JSON.stringify(store())).toBe(before);
  });

  it('refuses a conflicting merge and changes nothing', async () => {
    const { herren } = seed();
    const before = JSON.stringify(store());
    const incoming = buildExport({ ...selectAppData(store()), photos: [] }, { teamId: herren.id });
    incoming.players = [{ ...incoming.players[0], id: 'new-id' }]; // another #7 in the team
    incoming.matches = [];
    mockPick.mockResolvedValue({ name: 'clash.json', text: serializeExport(incoming) });
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Import from file'));
    await fireEvent.press(await screen.findByLabelText('Merge'));
    expect(screen.getByText(/same jersey number/)).toBeTruthy();
    expect(JSON.stringify(store())).toBe(before);
  });

  it('does nothing when the picker is cancelled, and can cancel a preview', async () => {
    seed();
    const before = JSON.stringify(store());
    mockPick.mockResolvedValueOnce(null);
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Import from file'));
    expect(screen.queryByTestId('import-preview')).toBeNull();

    mockPick.mockResolvedValueOnce({ name: 'b.json', text: fileText(otherData()) });
    await fireEvent.press(screen.getByLabelText('Import from file'));
    await fireEvent.press(await screen.findByLabelText('Cancel import'));
    expect(screen.queryByTestId('import-preview')).toBeNull();
    expect(JSON.stringify(store())).toBe(before);
  });

  it('reports a file that cannot be read', async () => {
    mockPick.mockRejectedValue(new Error('denied'));
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Import from file'));
    expect(await screen.findByText(/could not be read/)).toBeTruthy();
  });
});

describe('export', () => {
  it('exports everything as a valid file named with the date', async () => {
    seed();
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Export everything'));

    expect(mockSave).toHaveBeenCalledTimes(1);
    const [name, text] = mockSave.mock.calls[0];
    expect(name).toMatch(/^volley-lineup-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = parseImport(text);
    expect(parsed.ok && parsed.summary).toEqual({
      profiles: 2,
      teams: 3,
      players: 1,
      matches: 1,
      presets: 0,
      photos: 0,
      descriptions: 0,
      seasons: 1,
    });
    expect(await screen.findByText(`Exported ${name}.`)).toBeTruthy();
  });

  it("exports one of the current profile's teams", async () => {
    seed();
    await renderSettings();
    expect(screen.queryByLabelText('Export Mixed: only this team')).toBeNull(); // other profile
    await fireEvent.press(screen.getByLabelText('Export Herren 1: only this team'));

    const [name, text] = mockSave.mock.calls[0];
    expect(name).toMatch(/^volley-lineup-herren-1-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = parseImport(text);
    expect(parsed.ok && parsed.summary).toEqual({
      profiles: 1,
      teams: 1,
      players: 1,
      matches: 1,
      presets: 0,
      photos: 0,
      descriptions: 0,
      seasons: 1,
    });
  });

  it('shows an error when saving fails', async () => {
    mockSave.mockRejectedValueOnce(new Error('no'));
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Export everything'));
    expect(await screen.findByText('Export failed. Please try again.')).toBeTruthy();
  });
});

describe('round trip through the screen', () => {
  it('export → delete all → import (replace) restores identical data', async () => {
    seed();
    const original = selectAppData(store());
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Export everything'));
    const [name, text] = mockSave.mock.calls[0];

    await fireEvent.press(screen.getByLabelText('Delete all data'));
    await fireEvent.press(screen.getByLabelText('Yes, delete everything'));
    expect(store().profiles).toEqual([]);

    mockPick.mockResolvedValue({ name, text });
    await fireEvent.press(screen.getByLabelText('Import from file'));
    await fireEvent.press(await screen.findByLabelText('Replace'));
    expect(selectAppData(store())).toEqual(original);
    expect(store().currentProfileId).toBeNull(); // two profiles: the user picks one
  });
});

describe('delete all and version', () => {
  it('shows the app version; switching profile moved to the Profile tab', async () => {
    seed();
    await renderSettings();
    expect(screen.getByText(/Version/)).toBeTruthy();
    expect(screen.queryByLabelText('Switch profile')).toBeNull();
  });

  it('switches the player chips between numbers and names (EN + DE)', async () => {
    await renderSettings();
    const toggle = screen.getByRole('switch', { name: 'Prioritise names' });
    expect(store().chipLabel).toBe('number');
    await fireEvent.press(toggle);
    expect(store().chipLabel).toBe('name');

    store().setLanguage('de');
    const de = await screen.findByRole('switch', { name: 'Namen bevorzugen' });
    await fireEvent.press(de);
    expect(store().chipLabel).toBe('number');
    store().setLanguage('en');
  });

  it('says that saved lineups (presets and team starters) are deleted too', async () => {
    seed();
    await renderSettings();
    expect(
      screen.getByText(
        'Removes every profile, team, player, photo, season, match and saved lineup (presets and team starters) from this device.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Delete all data'));
    expect(screen.getByTestId('delete-confirm')).toHaveTextContent(
      /matches and saved lineups \(presets and team starters\) will be deleted/,
    );
  });

  it('asks for confirmation before deleting all data', async () => {
    seed();
    await renderSettings();

    await fireEvent.press(screen.getByLabelText('Delete all data'));
    await fireEvent.press(screen.getByLabelText('Keep my data'));
    expect(store().profiles).toHaveLength(2);

    await fireEvent.press(screen.getByLabelText('Delete all data'));
    await fireEvent.press(screen.getByLabelText('Yes, delete everything'));
    expect(selectAppData(store())).toEqual({
      profiles: [],
      teams: [],
      players: [],
      matches: [],
      presets: [],
      seasons: [],
      opponents: [],
    });
    expect(screen.getByText('All data deleted.')).toBeTruthy();
    expect(store().currentProfileId).toBeNull();
  });
  it('clears an earlier export message when all data is deleted', async () => {
    seed();
    await renderSettings();
    await fireEvent.press(screen.getByLabelText('Export everything'));
    const [name] = mockSave.mock.calls[0];
    expect(await screen.findByText(`Exported ${name}.`)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Delete all data'));
    await fireEvent.press(screen.getByLabelText('Yes, delete everything'));
    expect(screen.getByText('All data deleted.')).toBeTruthy();
    expect(screen.queryByText(`Exported ${name}.`)).toBeNull();
  });
});
