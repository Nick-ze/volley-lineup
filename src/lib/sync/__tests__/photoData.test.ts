import {
  base64ToBytes,
  blobToBytes,
  bytesToBase64,
  bytesToDataUri,
  dataUriToBytes,
} from '../photoData';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('photo data', () => {
  it('base64 round-trips every length', () => {
    for (const text of ['', 'a', 'ab', 'abc', 'abcd', 'hello world!']) {
      const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0)));
      const b64 = bytesToBase64(bytes);
      expect(b64).toBe(Buffer.from(text, 'latin1').toString('base64'));
      expect([...base64ToBytes(b64)]).toEqual([...bytes]);
    }
    expect(() => base64ToBytes('ab$c')).toThrow('invalid base64');
  });

  it('a photo data URI ↔ bytes with its type (sniffed back from the bytes)', () => {
    const jpeg = dataUriToBytes(JPEG);
    expect(jpeg?.contentType).toBe('image/jpeg');
    expect(bytesToDataUri(jpeg?.bytes as Uint8Array)).toBe(JPEG);
    const png = dataUriToBytes(PNG);
    expect(png?.contentType).toBe('image/png');
    expect(bytesToDataUri(png?.bytes as Uint8Array)).toBe(PNG);
    const webp = new Uint8Array([...'RIFF\0\0\0\0WEBPVP8 '].map((c) => c.charCodeAt(0)));
    expect(bytesToDataUri(webp)).toMatch(/^data:image\/webp;base64,/);
  });

  it('rejects what isn’t a small photo', () => {
    expect(dataUriToBytes('data:text/plain;base64,aGk=')).toBeNull();
    expect(bytesToDataUri(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(bytesToDataUri(new Uint8Array(200_000).fill(0xff))).toBeNull();
  });

  describe('reading a Blob (FileReader, as in React Native and browsers)', () => {
    class FakeReader {
      result: string | null = null;
      error: Error | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(blob: { data: string; fail?: boolean }) {
        if (blob.fail) {
          this.error = new Error('denied');
          this.onerror?.();
          return;
        }
        this.result = blob.data;
        this.onload?.();
      }
    }
    const blob = (data: string, fail = false) => ({ data, fail }) as unknown as Blob;

    beforeEach(() => {
      (globalThis as { FileReader?: unknown }).FileReader = FakeReader;
    });
    afterEach(() => {
      delete (globalThis as { FileReader?: unknown }).FileReader;
    });

    it('gives the bytes', async () => {
      expect([...(await blobToBytes(blob('data:image/jpeg;base64,/9g=')))]).toEqual([0xff, 0xd8]);
      expect([...(await blobToBytes(blob('')))]).toEqual([]);
    });

    it('rejects when reading fails or the content is broken', async () => {
      await expect(blobToBytes(blob('', true))).rejects.toThrow('denied');
      await expect(blobToBytes(blob('data:x;base64,@@'))).rejects.toThrow('invalid base64');
    });
  });
});
