import type { DeviceUnlock } from './unlock';

export type { UnlockOptions, UnlockResult } from './unlock';

/** Web has no device lock to ask: always use the in-app confirmation. */
export const deviceUnlock: DeviceUnlock = () => Promise.resolve('confirm');
