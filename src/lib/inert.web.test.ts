import { makeInert, setInert } from './inert.web';

describe('makeInert (web)', () => {
  it('sets the inert attribute and ignores null', () => {
    const attrs = new Map<string, string>();
    const el = { setAttribute: (k: string, v: string) => attrs.set(k, v) };
    makeInert(el as never);
    expect(attrs.get('inert')).toBe('');
    expect(() => makeInert(null)).not.toThrow();
  });

  it('turns inert on and off (v8.1.1 pager pages)', () => {
    const attrs = new Map<string, string>();
    const el = {
      setAttribute: (k: string, v: string) => attrs.set(k, v),
      removeAttribute: (k: string) => attrs.delete(k),
    };
    setInert(el as never, true);
    expect(attrs.has('inert')).toBe(true);
    setInert(el as never, false);
    expect(attrs.has('inert')).toBe(false);
    expect(() => setInert(null, true)).not.toThrow();
  });
});
