import {
  isPhotoDataUri,
  isValidDescription,
  keepReferencedPhotos,
  MAX_DESCRIPTION_LENGTH,
  MAX_PHOTO_DATA_LENGTH,
  normalizeDescription,
  PHOTO_QUALITY,
  PHOTO_SIZE,
  referencedPhotoIds,
  withoutDescription,
} from './photos';

const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';

describe('photo data URIs', () => {
  it('accepts small base64 JPEG, PNG and WebP data URIs', () => {
    expect(isPhotoDataUri(jpeg)).toBe(true);
    expect(isPhotoDataUri('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isPhotoDataUri('data:image/webp;base64,UklGRg')).toBe(true);
  });

  it('rejects other strings, other types and oversized data', () => {
    expect(isPhotoDataUri('')).toBe(false);
    expect(isPhotoDataUri('https://example.com/a.jpg')).toBe(false);
    expect(isPhotoDataUri('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isPhotoDataUri('data:image/jpeg;base64,not base64!')).toBe(false);
    const big = `data:image/jpeg;base64,${'A'.repeat(MAX_PHOTO_DATA_LENGTH)}`;
    expect(isPhotoDataUri(big)).toBe(false);
  });

  it('uses 256 px pictures at JPEG quality 0.7', () => {
    expect(PHOTO_SIZE).toBe(256);
    expect(PHOTO_QUALITY).toBe(0.7);
  });
});

describe('referenced photos', () => {
  const data = {
    profiles: [{ photoId: 'a' }, {}],
    players: [{ photoId: 'b' }, { photoId: 'a' }, {}],
    teams: [{}, { photoId: 'c' }],
  };

  it('collects the ids profiles, players and teams refer to', () => {
    expect([...referencedPhotoIds(data)]).toEqual(['a', 'b', 'c']);
  });

  it('drops orphan photos and keeps the order', () => {
    const photos = [
      { id: 'b', dataUri: jpeg },
      { id: 'x', dataUri: jpeg },
      { id: 'a', dataUri: jpeg },
      { id: 'c', dataUri: jpeg },
    ];
    expect(keepReferencedPhotos(photos, data).map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('descriptions', () => {
  it('trims, leaves out blank texts and cuts long ones', () => {
    expect(normalizeDescription('  Strong serve. ')).toBe('Strong serve.');
    expect(normalizeDescription('   ')).toBeUndefined();
    expect(normalizeDescription(undefined)).toBeUndefined();
    expect(normalizeDescription('x'.repeat(MAX_DESCRIPTION_LENGTH + 5))).toHaveLength(1000);
  });

  it('validates stored descriptions', () => {
    expect(isValidDescription('ok')).toBe(true);
    expect(isValidDescription('')).toBe(false);
    expect(isValidDescription(' padded ')).toBe(false);
    expect(isValidDescription('x'.repeat(MAX_DESCRIPTION_LENGTH + 1))).toBe(false);
  });

  it('removes the description from a player', () => {
    const player = { id: 'p', description: 'secret' };
    expect(withoutDescription(player)).toEqual({ id: 'p' });
    const plain: { id: string; description?: string } = { id: 'q' };
    expect(withoutDescription(plain)).toBe(plain);
  });
});
