import Constants from 'expo-constants';

import { canShareText, shareText, webAppBase } from './share.web';

type Globals = { navigator?: unknown; location?: unknown };
const g = globalThis as Globals;

describe('share (web)', () => {
  const original = { navigator: g.navigator, location: g.location };
  afterEach(() => {
    g.navigator = original.navigator;
    g.location = original.location;
  });

  it('uses the browser share sheet when there is one', async () => {
    const share = jest.fn(async () => undefined);
    g.navigator = { share };
    expect(canShareText()).toBe(true);
    await expect(shareText('Join us', 'Join Herren 1')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'Join us', title: 'Join Herren 1' });
  });

  it('a closed share sheet is not copied', async () => {
    const writeText = jest.fn(async () => undefined);
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    g.navigator = { share: jest.fn(async () => Promise.reject(abort)), clipboard: { writeText } };
    await expect(shareText('x')).resolves.toBe('dismissed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies when sharing fails or there is no share sheet', async () => {
    const writeText = jest.fn(async () => undefined);
    g.navigator = {
      share: jest.fn(async () => Promise.reject(new Error('not allowed'))),
      clipboard: { writeText },
    };
    await expect(shareText('x')).resolves.toBe('copied');
    g.navigator = { clipboard: { writeText } };
    expect(canShareText()).toBe(false);
    await expect(shareText('y')).resolves.toBe('copied');
    expect(writeText).toHaveBeenLastCalledWith('y');
  });

  it('fails without a clipboard or when copying is refused', async () => {
    g.navigator = {};
    await expect(shareText('x')).resolves.toBe('failed');
    g.navigator = undefined;
    expect(canShareText()).toBe(false);
    await expect(shareText('x')).resolves.toBe('failed');
    g.navigator = {
      clipboard: { writeText: jest.fn(async () => Promise.reject(new Error('no'))) },
    };
    await expect(shareText('x')).resolves.toBe('failed');
  });

  it('builds the web address from the page origin and the base path', () => {
    g.location = { origin: 'https://nick-ze.github.io' };
    const config = Constants.expoConfig as { experiments?: { baseUrl?: string } } | null;
    const before = config?.experiments;
    if (config) config.experiments = { baseUrl: '/volley-lineup' };
    expect(webAppBase()).toBe(config ? 'https://nick-ze.github.io/volley-lineup' : undefined);
    if (config) config.experiments = {};
    expect(webAppBase()).toBe(config ? 'https://nick-ze.github.io' : undefined);
    if (config) config.experiments = before;
    g.location = { origin: 'null' };
    expect(webAppBase()).toBeUndefined();
    g.location = undefined;
    expect(webAppBase()).toBeUndefined();
  });
});
