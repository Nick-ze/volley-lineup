/**
 * v6, phones: camera (after asking for access) or the system photo picker, with its square
 * crop step. See `pickPhoto.ts` for the contract.
 */
import { pickPhotoWith, type PhotoSource, type PickPhotoResult } from './pickPhotoShared';

export type { PhotoSource, PickPhotoResult } from './pickPhotoShared';

export const canTakePhoto = (): boolean => true;

export const pickPhoto = (source: PhotoSource): Promise<PickPhotoResult> =>
  pickPhotoWith(source, { askCameraPermission: true, allowsEditing: true });
