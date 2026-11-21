import { jpegDataUri, squareCrop } from './photoCrop';
import { MAX_PHOTO_DATA_LENGTH, PHOTO_SIZE } from './photos';

describe('squareCrop', () => {
  it('crops the centre of a landscape picture and scales it to PHOTO_SIZE', () => {
    expect(squareCrop(4000, 3000)).toEqual({
      crop: { originX: 500, originY: 0, width: 3000, height: 3000 },
      size: PHOTO_SIZE,
    });
  });

  it('crops the centre of a portrait picture', () => {
    expect(squareCrop(1080, 1921)).toEqual({
      crop: { originX: 0, originY: 420, width: 1080, height: 1080 },
      size: 256,
    });
  });

  it('never scales a small picture up', () => {
    expect(squareCrop(100, 120)).toEqual({
      crop: { originX: 0, originY: 10, width: 100, height: 100 },
      size: 100,
    });
  });

  it('copes with fractional and empty sizes', () => {
    expect(squareCrop(300.6, 300.2).crop).toEqual({
      originX: 0,
      originY: 0,
      width: 300,
      height: 300,
    });
    expect(squareCrop(0, 0)).toEqual({
      crop: { originX: 0, originY: 0, width: 1, height: 1 },
      size: 1,
    });
  });
});

describe('jpegDataUri', () => {
  it('prefixes base64 data', () => {
    expect(jpegDataUri('AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });

  it('rejects data that is not base64 or too large', () => {
    expect(jpegDataUri('not base64!')).toBeNull();
    expect(jpegDataUri('')).toBeNull();
    expect(jpegDataUri('A'.repeat(MAX_PHOTO_DATA_LENGTH))).toBeNull();
  });
});
