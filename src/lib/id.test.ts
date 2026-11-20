import * as Crypto from 'expo-crypto';

import { createId } from './id';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

describe('createId', () => {
  it('uses crypto.randomUUID when available', () => {
    (Crypto.randomUUID as jest.Mock).mockReturnValueOnce('uuid-1');
    expect(createId()).toBe('uuid-1');
  });

  it('falls back to a unique id when crypto throws or returns nothing', () => {
    (Crypto.randomUUID as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no crypto');
    });
    (Crypto.randomUUID as jest.Mock).mockReturnValueOnce(undefined);
    const a = createId();
    const b = createId();
    expect(a).toMatch(/^id-/);
    expect(a).not.toBe(b);
  });
});
