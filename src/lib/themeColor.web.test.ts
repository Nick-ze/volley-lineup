import { setThemeColor } from './themeColor.web';

/** A minimal `document` with a head that can hold meta tags. */
function fakeDocument(existing: boolean) {
  const metas: { attrs: Map<string, string>; setAttribute: (k: string, v: string) => void }[] = [];
  const makeMeta = () => {
    const attrs = new Map<string, string>();
    const meta = { attrs, setAttribute: (k: string, v: string) => void attrs.set(k, v) };
    return meta;
  };
  if (existing) {
    const meta = makeMeta();
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#000000');
    metas.push(meta);
  }
  const doc = {
    querySelector: (selector: string) =>
      selector === 'meta[name="theme-color"]'
        ? (metas.find((m) => m.attrs.get('name') === 'theme-color') ?? null)
        : null,
    createElement: () => makeMeta(),
    head: { appendChild: (m: (typeof metas)[number]) => void metas.push(m) },
  };
  return { doc, metas };
}

describe('setThemeColor (web)', () => {
  const original = (globalThis as { document?: unknown }).document;
  afterEach(() => {
    (globalThis as { document?: unknown }).document = original;
  });

  it('updates the existing theme-color meta tag', () => {
    const { doc, metas } = fakeDocument(true);
    (globalThis as { document?: unknown }).document = doc;
    setThemeColor('#FFFFFF');
    expect(metas).toHaveLength(1);
    expect(metas[0]?.attrs.get('content')).toBe('#FFFFFF');
  });

  it('adds the meta tag when the page has none', () => {
    const { doc, metas } = fakeDocument(false);
    (globalThis as { document?: unknown }).document = doc;
    setThemeColor('#0D0D0D');
    expect(metas).toHaveLength(1);
    expect(metas[0]?.attrs.get('name')).toBe('theme-color');
    expect(metas[0]?.attrs.get('content')).toBe('#0D0D0D');
  });

  it('does nothing without a document', () => {
    (globalThis as { document?: unknown }).document = undefined;
    expect(() => setThemeColor('#FFFFFF')).not.toThrow();
  });
});
