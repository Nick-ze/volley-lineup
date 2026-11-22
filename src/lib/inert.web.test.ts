import { makeInert } from './inert.web';

describe('makeInert (web)', () => {
  it('sets the inert attribute and ignores null', () => {
    const attrs = new Map<string, string>();
    const el = { setAttribute: (k: string, v: string) => attrs.set(k, v) };
    makeInert(el as never);
    expect(attrs.get('inert')).toBe('');
    expect(() => makeInert(null)).not.toThrow();
  });
});
