/**
 * v6: picking a profile / player picture and turning it into a small stored photo. Used by
 * `pickPhoto.web.ts` and `pickPhoto.native.ts`, which only decide what each platform offers.
 *
 * expo-image-picker opens the camera or the gallery (on web a file input); expo-image-manipulator
 * crops the centre square, scales it to `PHOTO_SIZE` px and compresses it to a JPEG
 * (`PHOTO_QUALITY`) with base64 output, which becomes the data URI the photo store keeps.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { jpegDataUri, squareCrop } from '@/domain/photoCrop';
import { PHOTO_QUALITY } from '@/domain/photos';

export type PhotoSource = 'camera' | 'library';

export type PickPhotoResult =
  | { status: 'picked'; dataUri: string }
  | { status: 'cancelled' }
  /** Camera (or photo) access was refused. */
  | { status: 'denied' }
  /** The picture couldn't be read or compressed small enough. */
  | { status: 'failed' };

export interface PickPhotoOptions {
  /** Ask for camera access before opening the camera (phones; browsers ask by themselves). */
  askCameraPermission: boolean;
  /** Let the user crop to a square in the system picker (phones). */
  allowsEditing: boolean;
}

/** Crops the centre square, scales it down and compresses it; null when that fails. */
export async function compressPhoto(uri: string): Promise<string | null> {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  const { crop, size } = squareCrop(original.width, original.height);
  const image = await ImageManipulator.manipulate(original)
    .crop(crop)
    .resize({ width: size, height: size })
    .renderAsync();
  const saved = await image.saveAsync({
    base64: true,
    compress: PHOTO_QUALITY,
    format: SaveFormat.JPEG,
  });
  return saved.base64 ? jpegDataUri(saved.base64) : null;
}

function isPermissionError(error: unknown): boolean {
  return error instanceof Error && /permission/i.test(error.message);
}

/** Opens the camera or the gallery and returns the compressed picture (never throws). */
export async function pickPhotoWith(
  source: PhotoSource,
  options: PickPhotoOptions,
): Promise<PickPhotoResult> {
  try {
    if (source === 'camera' && options.askCameraPermission) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
    }
    const launch =
      source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launch({
      mediaTypes: ['images'],
      allowsEditing: options.allowsEditing,
      aspect: [1, 1],
      quality: 1,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return { status: 'cancelled' };
    const dataUri = await compressPhoto(asset.uri);
    return dataUri ? { status: 'picked', dataUri } : { status: 'failed' };
  } catch (error) {
    return { status: isPermissionError(error) ? 'denied' : 'failed' };
  }
}
