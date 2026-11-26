import { JSDOM } from 'jsdom';

import { PRINT_CLEANUP_MS, printHtml } from './print.web';

// The jest-expo preset can't run in the jsdom environment, so give this file its own DOM.
const dom = new JSDOM('<!DOCTYPE html><html><head><title></title></head><body></body></html>');
const { document, HTMLIFrameElement, Event } = dom.window;
Object.assign(globalThis, { document });

type FakeWindow = {
  print: jest.Mock;
  focus: jest.Mock;
  listeners: Record<string, () => void>;
  addEventListener: (type: string, fn: () => void) => void;
};

let fakeWin: FakeWindow | null;
let contentWindowSpy: jest.SpyInstance;

const makeWin = (): FakeWindow => {
  const win: FakeWindow = {
    print: jest.fn(),
    focus: jest.fn(),
    listeners: {},
    addEventListener: (type, fn) => {
      win.listeners[type] = fn;
    },
  };
  return win;
};

const frame = () => document.querySelector<HTMLIFrameElement>('[data-testid="print-frame"]');

/** Starts printing and fires the iframe's load event (jsdom does not render srcdoc). */
const start = (html: string, title?: string) => {
  const promise = printHtml(html, { title });
  frame()?.dispatchEvent(new Event('load'));
  return promise;
};

beforeEach(() => {
  jest.useFakeTimers();
  document.title = 'Volley Lineup';
  fakeWin = makeWin();
  contentWindowSpy = jest
    .spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get')
    .mockImplementation(() => fakeWin as unknown as Window);
});

afterEach(() => {
  contentWindowSpy.mockRestore();
  jest.useRealTimers();
  document.body.innerHTML = '';
});

describe('web printHtml', () => {
  it('prints the HTML from a hidden iframe and cleans up after printing', async () => {
    let titleWhilePrinting = '';
    fakeWin?.print.mockImplementation(() => {
      titleWhilePrinting = document.title;
    });
    const promise = printHtml('<p>sheet</p>', { title: 'Lineup sheet' });
    const el = frame();
    expect(el).not.toBeNull();
    expect(el?.srcdoc).toBe('<p>sheet</p>');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
    expect(el?.style.visibility).toBe('hidden');
    el?.dispatchEvent(new Event('load'));
    await promise;

    expect(fakeWin?.focus).toHaveBeenCalled();
    expect(fakeWin?.print).toHaveBeenCalledTimes(1);
    expect(titleWhilePrinting).toBe('Lineup sheet');
    // The title is restored as soon as print() returns; the frame stays until afterprint.
    expect(document.title).toBe('Volley Lineup');
    expect(frame()).not.toBeNull();

    fakeWin?.listeners.afterprint();
    expect(frame()).toBeNull();
  });

  it('sandboxes the frame: no scripts, pop-ups, forms or navigation (audit L4)', async () => {
    void printHtml('<p>sheet</p>');
    const sandbox = frame()?.getAttribute('sandbox') ?? null;
    expect(sandbox).not.toBeNull();
    expect((sandbox ?? '').split(/\s+/).sort()).toEqual(['allow-modals', 'allow-same-origin']);
    frame()?.dispatchEvent(new Event('load'));
  });

  it('keeps the page title when none is given and removes the frame after a timeout', async () => {
    await start('<p/>');
    expect(document.title).toBe('Volley Lineup');
    expect(frame()).not.toBeNull();
    jest.advanceTimersByTime(PRINT_CLEANUP_MS);
    expect(frame()).toBeNull();
  });

  it('rejects when the iframe has no window', async () => {
    fakeWin = null;
    await expect(start('<p/>')).rejects.toThrow('Could not open the print view.');
    expect(frame()).toBeNull();
  });

  it('rejects and cleans up when print throws', async () => {
    fakeWin?.print.mockImplementation(() => {
      throw new Error('blocked');
    });
    await expect(start('<p/>', 'T')).rejects.toThrow('blocked');
    expect(frame()).toBeNull();
    expect(document.title).toBe('Volley Lineup');
  });
});
