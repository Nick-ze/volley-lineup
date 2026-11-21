/**
 * v6: picking a profile / player picture, per platform.
 *
 * Metro picks `pickPhoto.web.ts` on web and `pickPhoto.native.ts` on iOS/Android; this file
 * only defines the shared contract (TypeScript resolves imports here) and a fallback that
 * should never run. The shared work (picker + resize / compress) is in `pickPhotoShared.ts`.
 */
import type { PhotoSource, PickPhotoResult } from './pickPhotoShared';

export type { PhotoSource, PickPhotoResult } from './pickPhotoShared';

/** True when "Take photo" (the camera) is offered on this device. */
export const canTakePhoto = (): boolean => false;

/** Opens the camera or the gallery; resolves with a small JPEG data URI or why there is none. */
export const pickPhoto = (_source: PhotoSource): Promise<PickPhotoResult> =>
  Promise.resolve({ status: 'failed' });
