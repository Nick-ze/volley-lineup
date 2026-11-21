import * as LocalAuthentication from 'expo-local-authentication';

import { deviceUnlock } from './unlock.native';

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

const auth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const options = { promptMessage: 'Unlock', cancelLabel: 'Cancel' };

beforeEach(() => jest.clearAllMocks());

describe('native deviceUnlock', () => {
  it('asks biometrics / the device PIN and unlocks on success', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.SECRET);
    auth.authenticateAsync.mockResolvedValue({ success: true });
    await expect(deviceUnlock(options)).resolves.toBe('unlocked');
    expect(auth.authenticateAsync).toHaveBeenCalledWith({
      promptMessage: 'Unlock',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
  });

  it('a cancelled, failed or broken prompt does not unlock', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValue(LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK);
    auth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await expect(deviceUnlock(options)).resolves.toBe('failed');
    auth.authenticateAsync.mockRejectedValueOnce(new Error('boom'));
    await expect(deviceUnlock(options)).resolves.toBe('failed');
  });

  it('falls back to the in-app confirmation without anything set up', async () => {
    auth.getEnrolledLevelAsync.mockResolvedValueOnce(LocalAuthentication.SecurityLevel.NONE);
    await expect(deviceUnlock(options)).resolves.toBe('confirm');
    auth.getEnrolledLevelAsync.mockRejectedValueOnce(new Error('no module'));
    await expect(deviceUnlock(options)).resolves.toBe('confirm');
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });
});
