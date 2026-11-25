/**
 * v10: photos between the device (data URIs) and the storage bucket (bytes). Plain base64 code,
 * so it works the same in Hermes, browsers and Jest.
 */
import { isPhotoDataUri } from '@/domain/photos';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let out = 0;
  for (const c of clean) {
    const value = LOOKUP.get(c);
    if (value === undefined) throw new Error('invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += b === undefined ? '=' : ALPHABET[(n >> 6) & 63];
    out += c === undefined ? '=' : ALPHABET[n & 63];
  }
  return out;
}

/** A photo data URI as bytes and content type (null when it isn't a valid photo). */
export function dataUriToBytes(dataUri: string): { bytes: Uint8Array; contentType: string } | null {
  if (!isPhotoDataUri(dataUri)) return null;
  const comma = dataUri.indexOf(',');
  const contentType = dataUri.slice(5, dataUri.indexOf(';'));
  return { bytes: base64ToBytes(dataUri.slice(comma + 1)), contentType };
}

/** The image type from the file's first bytes (JPEG, PNG or WebP), else null. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === 'RIFF' && webp === 'WEBP' ? 'image/webp' : null;
}

/** Downloaded bytes as a photo data URI, or null when they aren't a small JPEG / PNG / WebP. */
export function bytesToDataUri(bytes: Uint8Array): string | null {
  const type = sniff(bytes);
  if (!type) return null;
  const uri = `data:${type};base64,${bytesToBase64(bytes)}`;
  return isPhotoDataUri(uri) ? uri : null;
}

/** A downloaded `Blob`'s bytes (FileReader: available in React Native and browsers). */
export function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      try {
        resolve(base64ToBytes(comma < 0 ? '' : result.slice(comma + 1)));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('read failed'));
      }
    };
    reader.readAsDataURL(blob);
  });
}
