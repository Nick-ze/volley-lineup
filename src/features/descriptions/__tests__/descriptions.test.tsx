import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { renderRouter } from 'expo-router/testing-library';
import { AppState } from 'react-native';

import { MAX_DESCRIPTION_LENGTH } from '@/domain/photos';
import type { ExportFile, Player } from '@/domain/types';
import { t } from '@/i18n/en';
import { buildExport, serializeExport } from '@/domain/exportSchema';
import { pickTextFile, saveTextFile } from '@/lib/fileTransfer';
import { selectAppData, STORAGE_KEY, useAppStore } from '@/store';

import { handleAppStateChange, setPrompting, useDescriptionLock } from '../descriptionLock';

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
jest.mock('@/lib/fileTransfer', () => ({
  saveTextFile: jest.fn(() => Promise.resolve()),
  pickTextFile: jest.fn(),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const mockSave = saveTextFile as jest.MockedFunction<typeof saveTextFile>;
const d = t.playerDetail.description;
const SECRET = 'Nervous on serve after a time-out';

const player = (n: number, description?: string): Player => ({
  id: `p${n}`,
  teamId: 't1',
  firstName: `First${n}`,
  lastName: `Last${n}`,
  number: n,
  positions: ['OH'],
  active: true,
  ...(description === undefined ? {} : { description }),
});

function seed() {
  useAppStore.getState().resetAll();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: 'prof', name: 'Coach', color: '#FF6B00', createdAt: '' }],
    teams: [{ id: 't1', profileId: 'prof', name: 'Herren 1', createdAt: '' }],
    players: [player(4, SECRET), player(5)],
    currentProfileId: 'prof',
  });
}

/** The device has biometrics / a PIN; the prompt answers `success`. */
function deviceLock(success: boolean) {
  auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG);
  auth.authenticateAsync.mockResolvedValue(
    success ? { success: true } : { success: false, error: 'user_cancel' },
  );
}
/** Nothing set up on the device: the in-app confirmation is used. */
function noDeviceLock() {
  auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.NONE);
}

const showButton = () => screen.getByRole('button', { name: d.showLabel });
const lockButton = () => screen.getByRole('button', { name: d.lockLabel });

/** The app's foreground state as AppState reports it right now. */
function appStateIs(state: 'active' | 'background') {
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true });
}

beforeEach(async () => {
  jest.clearAllMocks();
  appStateIs('active');
  useDescriptionLock.getState().lock();
  seed();
  await AsyncStorage.clear();
});

describe('confidential descriptions on the player detail', () => {
  it('are hidden by default: no text, no preview, and nothing in the roster', async () => {
    await renderRouter('./app', { initialUrl: '/team/t1' });
    expect(screen.getByTestId('player-4')).toBeTruthy();
    expect(screen.queryByText(SECRET, { exact: false })).toBeNull();

    await fireEvent.press(screen.getByTestId('player-4'));
    expect(showButton()).toBeTruthy();
    expect(screen.queryByText(SECRET, { exact: false })).toBeNull();
    expect(screen.queryByTestId('description-input')).toBeNull();
    // The locked card looks the same with or without a description.
    expect(screen.getByTestId('description-section')).toBeTruthy();
  });

  it('unlock with biometrics / PIN shows them; Lock hides them again', async () => {
    deviceLock(true);
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    await fireEvent.press(showButton());
    expect(auth.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: d.prompt,
      cancelLabel: d.cancel,
      disableDeviceFallback: false,
    });
    expect(screen.getByTestId('description-input').props.value).toBe(SECRET);
    expect(screen.getByText(d.count(SECRET.length, MAX_DESCRIPTION_LENGTH))).toBeTruthy();

    await fireEvent.press(lockButton());
    expect(screen.queryByTestId('description-input')).toBeNull();
    expect(showButton()).toBeTruthy();
  });

  it('a prompt that succeeds after the app left the foreground keeps them hidden', async () => {
    deviceLock(true);
    auth.authenticateAsync.mockImplementation(async () => {
      appStateIs('background');
      return { success: true };
    });
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    await fireEvent.press(showButton());
    expect(auth.authenticateAsync).toHaveBeenCalled();
    expect(useDescriptionLock.getState().unlocked).toBe(false);
    expect(screen.queryByTestId('description-input')).toBeNull();
  });

  it('a failed or cancelled prompt keeps them hidden', async () => {
    deviceLock(false);
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    await fireEvent.press(showButton());
    expect(auth.authenticateAsync).toHaveBeenCalled();
    expect(screen.getByText(d.failed)).toBeTruthy();
    expect(screen.queryByTestId('description-input')).toBeNull();
    expect(useDescriptionLock.getState().unlocked).toBe(false);
  });

  it('without biometrics / PIN, asks with the in-app confirmation', async () => {
    noDeviceLock();
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    await fireEvent.press(showButton());
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(d.confirmBody)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: d.cancel }));
    expect(screen.queryByTestId('description-input')).toBeNull();

    await fireEvent.press(showButton());
    await fireEvent.press(screen.getByRole('button', { name: d.confirm }));
    expect(screen.getByTestId('description-input').props.value).toBe(SECRET);
  });

  it('once unlocked, every player’s description is visible; edits are saved (blank removes)', async () => {
    useDescriptionLock.getState().unlock();
    await renderRouter('./app', { initialUrl: '/team/t1/players/p5' });
    const input = screen.getByTestId('description-input');
    expect(input.props.value).toBe('');
    expect(input.props.maxLength).toBe(MAX_DESCRIPTION_LENGTH);

    await fireEvent.changeText(input, '  Strong jump serve  ');
    await fireEvent.press(screen.getByRole('button', { name: d.save }));
    expect(useAppStore.getState().players[1].description).toBe('Strong jump serve');
    expect(screen.getByText(d.saved)).toBeTruthy();
    expect(screen.getByTestId('description-input').props.value).toBe('Strong jump serve');

    await fireEvent.changeText(screen.getByTestId('description-input'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: d.save }));
    expect(useAppStore.getState().players[1].description).toBeUndefined();
    expect(screen.getByText(d.removed)).toBeTruthy();
  });
});

describe('the unlock state', () => {
  it('locks when the app goes to the background or becomes inactive', () => {
    const { unlock } = useDescriptionLock.getState();
    unlock();
    handleAppStateChange('active');
    expect(useDescriptionLock.getState().unlocked).toBe(true);
    handleAppStateChange('background'); // also web: visibilitychange → hidden
    expect(useDescriptionLock.getState().unlocked).toBe(false);

    unlock();
    handleAppStateChange('inactive');
    expect(useDescriptionLock.getState().unlocked).toBe(false);
  });

  it('our own unlock prompt (iOS: inactive) does not lock; real backgrounding does', () => {
    useDescriptionLock.getState().unlock();
    setPrompting(true);
    handleAppStateChange('inactive');
    expect(useDescriptionLock.getState().unlocked).toBe(true);
    handleAppStateChange('background');
    expect(useDescriptionLock.getState().unlocked).toBe(false);
    setPrompting(false);
  });

  it('listens to AppState app-wide', () => {
    const spy = jest.spyOn(AppState, 'addEventListener');
    jest.isolateModules(() => {
      // A fresh, synchronous load of the module (like an app start).
      const fresh = jest.requireActual<typeof import('../descriptionLock')>('../descriptionLock');
      expect(spy).toHaveBeenCalledWith('change', fresh.handleAppStateChange);
      // A fresh module (= app restart) starts locked.
      expect(fresh.useDescriptionLock.getState()).toMatchObject({
        unlocked: false,
        includeInExport: false,
      });
    });
    spy.mockRestore();
  });

  it('a background change locks an open detail screen', async () => {
    useDescriptionLock.getState().unlock();
    await renderRouter('./app', { initialUrl: '/team/t1/players/p4' });
    expect(screen.getByTestId('description-input')).toBeTruthy();
    await act(async () => handleAppStateChange('background'));
    expect(screen.queryByTestId('description-input')).toBeNull();
    expect(showButton()).toBeTruthy();
  });

  it('is never persisted', async () => {
    useDescriptionLock.getState().unlock();
    useDescriptionLock.getState().setIncludeInExport(true);
    useAppStore.getState().updatePlayer('p5', { lastName: 'Changed' });
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_KEY)).not.toBeNull());
    const keys = await AsyncStorage.getAllKeys();
    const values = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
    const all = values.join('\n');
    expect(all).toContain('Changed');
    expect(all).not.toMatch(/unlocked|includeInExport/);
  });

  it('"include in export" only exists while unlocked', () => {
    const s = useDescriptionLock.getState();
    s.setIncludeInExport(true);
    expect(useDescriptionLock.getState().includeInExport).toBe(false);
    s.unlock();
    s.setIncludeInExport(true);
    expect(useDescriptionLock.getState().includeInExport).toBe(true);
    s.lock();
    expect(useDescriptionLock.getState().includeInExport).toBe(false);
  });
});

describe('Settings → Export: Include descriptions', () => {
  const exported = (): ExportFile => JSON.parse(mockSave.mock.calls.at(-1)?.[1] as string);
  const checkbox = () => screen.getByTestId('export-include-descriptions');

  it('is disabled while locked; ticked, the file contains the descriptions', async () => {
    noDeviceLock();
    await renderRouter('./app', { initialUrl: '/settings' });
    expect(checkbox()).toBeDisabled();
    expect(checkbox()).not.toBeChecked();
    expect(screen.getByText(t.transfer.export.includeDescriptionsLocked)).toBeTruthy();
    await fireEvent.press(checkbox());
    expect(useDescriptionLock.getState().includeInExport).toBe(false);

    await fireEvent.press(screen.getByLabelText(t.transfer.export.all));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(exported().players.find((p) => p.id === 'p4')?.description).toBeUndefined();

    // Unlock (in-app confirmation), still off by default.
    await fireEvent.press(showButton());
    await fireEvent.press(screen.getByRole('button', { name: d.confirm }));
    expect(checkbox()).toBeEnabled();
    expect(checkbox()).not.toBeChecked();
    await fireEvent.press(screen.getByLabelText(t.transfer.export.all));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(exported().players.find((p) => p.id === 'p4')?.description).toBeUndefined();

    await fireEvent.press(checkbox());
    expect(checkbox()).toBeChecked();
    await fireEvent.press(screen.getByLabelText(t.transfer.export.teamLabel('Herren 1')));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
    expect(exported().players.find((p) => p.id === 'p4')?.description).toBe(SECRET);

    // Locking turns it off again.
    await fireEvent.press(lockButton());
    expect(checkbox()).not.toBeChecked();
    expect(checkbox()).toBeDisabled();
    await fireEvent.press(screen.getByLabelText(t.transfer.export.all));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(4));
    expect(exported().players.find((p) => p.id === 'p4')?.description).toBeUndefined();
  });
});

describe('Settings → Import preview', () => {
  it('mentions how many descriptions the file holds (never their text)', async () => {
    const file = buildExport(
      { ...selectAppData(useAppStore.getState()), photos: [] },
      {
        includeDescriptions: true,
      },
    );
    (pickTextFile as jest.MockedFunction<typeof pickTextFile>).mockResolvedValue({
      name: 'team.json',
      text: serializeExport(file),
    });
    await renderRouter('./app', { initialUrl: '/settings' });
    await fireEvent.press(screen.getByLabelText(t.transfer.import.pick));
    expect(await screen.findByText(t.transfer.import.descriptions(1))).toBeTruthy();
    expect(screen.queryByText(SECRET, { exact: false })).toBeNull();
  });
});
