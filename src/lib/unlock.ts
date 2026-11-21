/**
 * Unlocking confidential descriptions with the device's own lock, per platform (PLAN §25.3).
 *
 * Metro picks `unlock.native.ts` on iOS/Android (biometrics or the device PIN via
 * expo-local-authentication) and `unlock.web.ts` on web (no device lock: the app asks for an
 * in-app confirmation instead). This file defines the shared contract and the same fallback.
 *
 * - `'unlocked'`: the device confirmed the owner.
 * - `'failed'`: the prompt was cancelled or failed; keep the descriptions hidden.
 * - `'confirm'`: no device lock is available; ask with the in-app confirmation dialog.
 */
export type UnlockResult = 'unlocked' | 'failed' | 'confirm';

export interface UnlockOptions {
  /** Shown in the system prompt. */
  promptMessage: string;
  /** Label of the prompt's cancel button. */
  cancelLabel: string;
}

export type DeviceUnlock = (options: UnlockOptions) => Promise<UnlockResult>;

export const deviceUnlock: DeviceUnlock = () => Promise.resolve('confirm');
