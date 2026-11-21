import * as LocalAuthentication from 'expo-local-authentication';

import type { DeviceUnlock } from './unlock';

export type { UnlockOptions, UnlockResult } from './unlock';

/** True when biometrics or at least a device PIN / pattern / password is set up. */
async function deviceLockAvailable(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/**
 * Biometrics or the device PIN (the PIN fallback stays allowed). With nothing set up, the
 * in-app confirmation is used instead. A failed or cancelled prompt keeps everything hidden.
 */
export const deviceUnlock: DeviceUnlock = async ({ promptMessage, cancelLabel }) => {
  if (!(await deviceLockAvailable())) return 'confirm';
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
    });
    return result.success ? 'unlocked' : 'failed';
  } catch {
    return 'failed';
  }
};
