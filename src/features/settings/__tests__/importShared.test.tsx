/**
 * v10: importing while teams are shared through the cloud (design §3.12): shared teams are never
 * removed or replaced; a view-only team's copy in the file is skipped; the preview says so.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { buildExport, serializeExport, type TransferData } from '@/domain/exportSchema';
import type { TeamRole } from '@/domain/types';
import { t } from '@/i18n/en';
import { pickTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore } from '@/store';
import { goldenData, seedGolden } from '@/test-utils';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

const mockPick = jest.mocked(pickTextFile);
const store = () => useAppStore.getState();

function link(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'pr1' },
      teams: { t1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

/** A backup with both teams renamed (and without the device's newer player `px`). */
function fileText(change: (file: TransferData) => TransferData = (file) => file): string {
  const data = goldenData();
  const file: TransferData = change({
    ...data,
    teams: data.teams.map((x) => ({ ...x, name: `${x.name} (file)` })),
  });
  return serializeExport(buildExport(file, { now: new Date('2026-11-21T12:00:00Z') }));
}

const teamName = (id: string) => store().teams.find((x) => x.id === id)?.name;
const t1Players = () =>
  store()
    .players.filter((p) => p.teamId === 't1')
    .map((p) => p.id);

async function preview(text = fileText()) {
  mockPick.mockResolvedValue({ name: 'backup.json', text });
  await renderRouter(
    { index: () => <Text>Profile picker</Text>, settings: SettingsScreen },
    { initialUrl: '/settings' },
  );
  await fireEvent.press(screen.getByLabelText(t.transfer.import.pick));
  expect(await screen.findByTestId('import-preview')).toBeTruthy();
}

beforeEach(() => {
  jest.clearAllMocks();
  seedGolden();
  // A player added on this device after the backup.
  const px = { ...goldenData().players[0]!, id: 'px', number: 99, photoId: undefined };
  useAppStore.setState((st) => ({ players: [...st.players, px] }));
});

describe('import with a view-only team', () => {
  beforeEach(() => link('player'));

  it('the preview names the skipped team; Replace keeps it untouched', async () => {
    const before = selectAppData(store());
    await preview();
    expect(screen.getByTestId('import-skipped')).toHaveTextContent(
      t.sync.import.skipped(['Herren 1 – Süd (file)']),
    );
    expect(screen.queryByTestId('import-shared')).toBeNull();
    expect(screen.getByText(t.sync.import.replaceKeeps)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText(t.transfer.import.replace));
    expect(screen.getByText(t.transfer.import.doneReplace)).toBeTruthy();
    expect(store().teams.find((x) => x.id === 't1')).toEqual(
      before.teams.find((x) => x.id === 't1'),
    );
    expect(t1Players()).toContain('px');
    expect(teamName('t2')).toBe('Damen (file)');
    expect(store().sync.teams.t1?.role).toBe('player');
  });

  it('Merge skips the team too', async () => {
    await preview();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByText(t.transfer.import.doneMerge)).toBeTruthy();
    expect(teamName('t1')).toBe('Herren 1 – Süd');
    expect(teamName('t2')).toBe('Damen (file)');
  });
});

describe('import with a manager’s shared team', () => {
  beforeEach(() => link('manager'));

  it('the preview says the changes sync; Replace merges the team and deletes nothing', async () => {
    await preview();
    expect(screen.getByTestId('import-shared')).toHaveTextContent(
      t.sync.import.shared(['Herren 1 – Süd (file)']),
    );
    expect(screen.queryByTestId('import-skipped')).toBeNull();

    await fireEvent.press(screen.getByLabelText(t.transfer.import.replace));
    expect(teamName('t1')).toBe('Herren 1 – Süd (file)');
    expect(t1Players()).toContain('px');
    expect(store().teams.find((x) => x.id === 't1')?.profileId).toBe('pr1');
  });

  it('Replace with a reused jersey number explains the clash and changes nothing', async () => {
    // The backup still has "Old" with #99, which this device has given to `px` since.
    const old = { ...goldenData().players[1]!, id: 'p-old', number: 99 };
    const before = selectAppData(store());
    await preview(fileText((file) => ({ ...file, players: [...file.players, old] })));
    await fireEvent.press(screen.getByLabelText(t.transfer.import.replace));
    expect(screen.getByTestId('import-status')).toHaveTextContent(t.sync.import.sharedConflict);
    expect(screen.queryByText(t.transfer.import.errors.MERGE_CONFLICT)).toBeNull();
    expect(selectAppData(store())).toEqual(before);
  });
});

describe('import without shared teams', () => {
  it('has no shared-team notes and Replace replaces everything, as before', async () => {
    await preview();
    expect(screen.queryByTestId('import-shared')).toBeNull();
    expect(screen.queryByTestId('import-skipped')).toBeNull();
    expect(screen.queryByTestId('import-replace-keeps')).toBeNull();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.replace));
    expect(t1Players()).not.toContain('px');
  });
});
