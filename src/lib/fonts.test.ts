import { act, renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { appFonts, FONT_TIMEOUT_MS, useAppFonts } from './fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

beforeEach(() => {
  jest.useFakeTimers();
  mockUseFonts.mockReset();
});

afterEach(() => jest.useRealTimers());

describe('useAppFonts', () => {
  it('loads both OpenDyslexic families and is ready once they are loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(mockUseFonts).toHaveBeenCalledWith(appFonts);
    expect(Object.keys(appFonts)).toEqual(['OpenDyslexic-Regular', 'OpenDyslexic-Bold']);
    expect(result.current).toBe(true);
  });

  it('is ready when loading failed (the platform font is used)', async () => {
    mockUseFonts.mockReturnValue([false, new Error('no font')]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toBe(true);
  });

  it('waits while loading, but never longer than the timeout', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { result } = await renderHook(() => useAppFonts());
    expect(result.current).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(FONT_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
