/**
 * v6: how a picked picture becomes a stored photo (docs/PLAN.md §25.1, DECISIONS #148). Pure.
 *
 * The picture is cropped to the centre square (avatars are round) and scaled down to at most
 * `PHOTO_SIZE` px (never up), then compressed to JPEG (`PHOTO_QUALITY`) on the device.
 */
import { isPhotoDataUri, PHOTO_SIZE } from './photos';

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** The centre square of a `width` × `height` picture and the side it is scaled to. */
export function squareCrop(width: number, height: number): { crop: CropRect; size: number } {
  const side = Math.max(1, Math.floor(Math.min(width, height)));
  return {
    crop: {
      originX: Math.max(0, Math.floor((width - side) / 2)),
      originY: Math.max(0, Math.floor((height - side) / 2)),
      width: side,
      height: side,
    },
    size: Math.min(PHOTO_SIZE, side),
  };
}

/** `data:image/jpeg;base64,<base64>`, or null when that isn't a valid (small enough) photo. */
export function jpegDataUri(base64: string): string | null {
  const uri = `data:image/jpeg;base64,${base64}`;
  return isPhotoDataUri(uri) ? uri : null;
}
