import { cancelPress } from './cancelPress.web';

type Listener = (e: Event) => void;

describe('cancelPress (web)', () => {
  const g = globalThis as unknown as { document?: unknown; window?: unknown };
  let listeners: Map<string, Listener>;
  let removed: string[];
  let dispatched: Event[];

  beforeEach(() => {
    jest.useFakeTimers();
    listeners = new Map();
    removed = [];
    dispatched = [];
    g.window = {
      addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
      removeEventListener: (type: string) => removed.push(type),
    };
    g.document = { body: { dispatchEvent: (e: Event) => dispatched.push(e) } };
  });

  afterEach(() => {
    delete g.document;
    delete g.window;
    jest.useRealTimers();
  });

  it('ends the press at once and swallows the click after the drag', () => {
    cancelPress();
    expect(dispatched.map((e) => e.type)).toEqual(['dragstart']);
    const click = new Event('click', { cancelable: true });
    const stop = jest.spyOn(click, 'stopPropagation');
    listeners.get('click')?.(click);
    expect(stop).toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
  });

  it('stops waiting for a click once the pointer is up', () => {
    cancelPress();
    expect(listeners.get('pointercancel')).toBe(listeners.get('pointerup'));
    listeners.get('pointerup')?.(new Event('pointerup'));
    expect(removed).toEqual([]);
    jest.runAllTimers();
    expect(removed).toEqual(['click']);
  });

  it('does nothing without a document', () => {
    delete g.document;
    delete g.window;
    expect(() => cancelPress()).not.toThrow();
  });
});
