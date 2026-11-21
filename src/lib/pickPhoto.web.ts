/**
 * v6, web: a file input (expo-image-picker's web support). "Take photo" is only offered on
 * touch devices, where the browser can open the camera for an input with `capture`; desktop
 * browsers would just show the file chooser again. See `pickPhoto.ts` for the contract.
 */
import { pickPhotoWith, type PhotoSource, type PickPhotoResult } from './pickPhotoShared';

export type { PhotoSource, PickPhotoResult } from './pickPhotoShared';

export const canTakePhoto = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

// The browser asks for camera access itself; asking first would also lose the click that a
// file input needs to open.
export const pickPhoto = (source: PhotoSource): Promise<PickPhotoResult> =>
  pickPhotoWith(source, { askCameraPermission: false, allowsEditing: false });
