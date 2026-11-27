import { act, renderHook } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { appFonts, displayFonts, FONT_TIMEOUT_MS, useAppFonts } from './fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));

const mockUseFonts = useFonts as jest.MockedFunction<typeof useFonts>;

beforeEach(() => {
  jest.useFakeTimers();
  mockUseFonts.mockReset();
});

afterEach(() => jest.useRealTimers());

describe('useAppFonts', () => {
  it('loads the display typeface and both OpenDyslexic families', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    const { result } = await renderHook(() => useAppFonts(false));
    expect(mockUseFonts).toHaveBeenCalledWith(displayFonts);
    expect(mockUseFonts).toHaveBeenCalledWith(appFonts);
    expect(Object.keys(displayFonts)).toEqual([
      'BarlowCondensed-Bold',
      'BarlowCondensed-ExtraBold',
    ]);
    expect(Object.keys(appFonts)).toEqual(['OpenDyslexic-Regular', 'OpenDyslexic-Bold']);
    expect(result.current).toBe(true);
  });

  it('is ready when loading failed (the platform font is used)', async () => {
    mockUseFonts.mockReturnValue([false, new Error('no font')]);
    const { result } = await renderHook(() => useAppFonts(true));
    expect(result.current).toBe(true);
  });

  it('waits for OpenDyslexic only when the dyslexia font is on', async () => {
    mockUseFonts.mockImplementation((fonts) =>
      fonts === displayFonts ? [true, null] : [false, null],
    );
    const off = await renderHook(() => useAppFonts(false));
    expect(off.result.current).toBe(true);
    const on = await renderHook(() => useAppFonts(true));
    expect(on.result.current).toBe(false);
  });

  it('waits while the display typeface loads, but never longer than the timeout', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    const { result } = await renderHook(() => useAppFonts(false));
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
