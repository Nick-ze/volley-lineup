/**
 * v10 audit (docs/AUDIT_V10.md M15), found by the independent review of the fix: an import must
 * not overwrite a match another device is scoring live. The file's copy of the match (an older
 * backup) replaced the scorer's rallies on this device, was pushed as this device's newer save,
 * and took them from every device — Merge and Replace alike, for a manager's shared team.
 *
 * Now the import is refused while another device holds a match that the file would change, and
 * says so. Everything else about importing is unchanged.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { buildExport, serializeExport, type TransferData } from '@/domain/exportSchema';
import type { MatchHold, SetEvent, TeamRole } from '@/domain/types';
import { de } from '@/i18n/de';
import { t } from '@/i18n/en';
import { pickTextFile } from '@/lib/fileTransfer';
import { selectAppData, useAppStore, useSyncRuntime } from '@/store';
import { goldenData, seedGolden } from '@/test-utils';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

const mockPick = jest.mocked(pickTextFile);
const store = () => useAppStore.getState();
const rally: SetEvent = { type: 'point', winner: 'us' };

function link(role: TeamRole) {
  useAppStore.setState({
    sync: {
      deviceId: 'dev1',
      account: { userId: 'u1', email: 'coach@example.test', profileId: 'pr1' },
      teams: { t1: { userId: 'u1', role, cursor: 0, base: {}, edits: {}, photos: [] } },
    },
  });
}

const hold = (matchId: string, overrides: Partial<MatchHold> = {}): MatchHold => ({
  matchId,
  teamId: 't1',
  deviceId: 'dev-other',
  userId: 'u2',
  holderName: 'Anna',
  heldUntil: '2099-01-01T00:00:00.000Z',
  ...overrides,
});

const holdBy = (...holds: MatchHold[]) =>
  useSyncRuntime.setState({ holds: Object.fromEntries(holds.map((h) => [h.matchId, h])) });

/** A backup made before today's match: m2 has no rallies in it. */
function backup(change: (file: TransferData) => TransferData = (file) => file): string {
  return serializeExport(
    buildExport(change(goldenData()), { now: new Date('2026-11-21T12:00:00Z') }),
  );
}

/** The device as it is now: the other device's rallies of m2 have arrived by sync. */
function scoreM2() {
  useAppStore.setState((s) => ({
    matches: s.matches.map((m) =>
      m.id === 'm2'
        ? { ...m, sets: m.sets.map((x, i) => (i === 0 ? { ...x, events: [rally, rally] } : x)) }
        : m,
    ),
  }));
}

const ralliesOfM2 = () => store().matches.find((m) => m.id === 'm2')?.sets[0].events.length;

async function preview(text = backup()) {
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
  link('manager');
  scoreM2();
  useSyncRuntime.setState({ holds: {} });
});

describe('importing while another device scores a match live (audit M15)', () => {
  it.each([
    ['Merge', t.transfer.import.merge],
    ['Replace', t.transfer.import.replace],
  ])('%s of an older backup is refused and changes nothing', async (_mode, label) => {
    holdBy(hold('m2'));
    const before = selectAppData(store());
    await preview();
    await fireEvent.press(screen.getByLabelText(label));
    expect(screen.getByTestId('import-status')).toHaveTextContent(t.sync.import.liveMatch);
    expect(selectAppData(store())).toEqual(before);
    expect(ralliesOfM2()).toBe(2);
  });

  it('works again once the other device is done (the file then wins, as always)', async () => {
    holdBy(hold('m2'));
    await preview();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByTestId('import-status')).toHaveTextContent(t.sync.import.liveMatch);
    holdBy();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.pick));
    expect(await screen.findByTestId('import-preview')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByText(t.transfer.import.doneMerge)).toBeTruthy();
    expect(ralliesOfM2()).toBe(0);
  });

  it('a file that leaves the scored match as it is can be imported meanwhile', async () => {
    holdBy(hold('m2'));
    // The file has m2 exactly as the device has it now; another match differs.
    const same = backup((file) => ({
      ...file,
      matches: file.matches.map((m) =>
        m.id === 'm2'
          ? { ...m, sets: m.sets.map((x, i) => (i === 0 ? { ...x, events: [rally, rally] } : x)) }
          : m.id === 'm1'
            ? { ...m, opponent: 'Rivals (file)' }
            : m,
      ),
    }));
    await preview(same);
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByText(t.transfer.import.doneMerge)).toBeTruthy();
    expect(store().matches.find((m) => m.id === 'm1')?.opponent).toBe('Rivals (file)');
    expect(ralliesOfM2()).toBe(2);
  });

  it('this device’s own hold and a hold that has run out don’t stand in the way', async () => {
    holdBy(hold('m2', { deviceId: 'dev1' }), hold('m1', { heldUntil: '2020-01-01T00:00:00.000Z' }));
    await preview();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByText(t.transfer.import.doneMerge)).toBeTruthy();
  });

  it('a view-only team’s matches aren’t touched by an import anyway: no refusal', async () => {
    link('player');
    holdBy(hold('m2'));
    await preview();
    await fireEvent.press(screen.getByLabelText(t.transfer.import.merge));
    expect(screen.getByText(t.transfer.import.doneMerge)).toBeTruthy();
    expect(ralliesOfM2()).toBe(2);
  });

  it('says it in German too', () => {
    expect(de.sync.import.liveMatch).toMatch(/live gezählt/);
    expect(t.sync.import.liveMatch).toMatch(/scored live on another device/);
  });
});
