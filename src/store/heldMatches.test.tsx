/**
 * v10 audit M15: `useHeldMatches` and time — which matches another device is scoring live right
 * now, on a screen that stays open while holds end, are refreshed or arrive late (tests from the
 * independent review of the fix).
 */
import { act, renderHook } from '@testing-library/react-native';

import type { MatchHold } from '@/domain/types';
import { useAppStore, useHeldMatches, useSyncRuntime } from '@/store';

const T0 = Date.parse('2026-11-26T10:00:00.000Z');
const at = (ms: number) => new Date(T0 + ms).toISOString();
const MIN = 60_000;

const hold = (matchId: string, heldUntil: string, deviceId = 'dev-other'): MatchHold => ({
  matchId,
  teamId: 't1',
  deviceId,
  userId: 'u2',
  holderName: 'Anna',
  heldUntil,
});

const setHolds = (...holds: MatchHold[]) =>
  act(async () => {
    useSyncRuntime.setState({ holds: Object.fromEntries(holds.map((h) => [h.matchId, h])) });
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  useAppStore.setState({
    sync: { deviceId: 'dev1', account: null, teams: {} },
  });
  useSyncRuntime.setState({ holds: {} });
});
afterEach(() => jest.useRealTimers());

const IDS = ['m1', 'm2', 'm3'];
const held = (result: { current: ReadonlyMap<string, MatchHold> }) => [...result.current.keys()];

describe('useHeldMatches', () => {
  it('a hold that had run out before the screen opened doesn’t count', async () => {
    useSyncRuntime.setState({ holds: { m1: hold('m1', at(-1000)) } });
    const { result } = await renderHook(() => useHeldMatches(IDS));
    expect(held(result)).toEqual([]);
  });

  it('a hold ends while the screen is open', async () => {
    useSyncRuntime.setState({ holds: { m1: hold('m1', at(5 * MIN)) } });
    const { result } = await renderHook(() => useHeldMatches(IDS));
    expect(held(result)).toEqual(['m1']);
    await act(async () => {
      jest.advanceTimersByTime(5 * MIN + 100);
    });
    expect(held(result)).toEqual([]);
  });

  it('several holds end one after the other; a refreshed hold lasts longer', async () => {
    useSyncRuntime.setState({
      holds: { m1: hold('m1', at(5 * MIN)), m2: hold('m2', at(10 * MIN)) },
    });
    const { result } = await renderHook(() => useHeldMatches(IDS));
    expect(held(result)).toEqual(['m1', 'm2']);
    await act(async () => {
      jest.advanceTimersByTime(5 * MIN + 100);
    });
    expect(held(result)).toEqual(['m2']);
    // m2 is refreshed (15 more minutes), m3 starts.
    await setHolds(hold('m2', at(20 * MIN)), hold('m3', at(12 * MIN)));
    expect(held(result)).toEqual(['m2', 'm3']);
    await act(async () => {
      jest.advanceTimersByTime(7 * MIN + 100);
    });
    expect(held(result)).toEqual(['m2']);
    await act(async () => {
      jest.advanceTimersByTime(8 * MIN + 100);
    });
    expect(held(result)).toEqual([]);
  });

  it('a hold that arrives long after the screen opened and has already run out', async () => {
    const { result } = await renderHook(() => useHeldMatches(IDS));
    await act(async () => {
      jest.advanceTimersByTime(30 * MIN);
    });
    // The device was offline: the hold it learns of now ended 10 minutes ago (after mount).
    await setHolds(hold('m1', at(20 * MIN)));
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(held(result)).toEqual([]);
  });

  it('ends in two time formats sort by time', async () => {
    // The server's format and the L17 fallback's (toISOString) on the same screen.
    useSyncRuntime.setState({
      holds: {
        m1: hold('m1', '2026-11-26T10:05:00.5+00:00'),
        m2: hold('m2', '2026-11-26T10:05:00.123Z'),
      },
    });
    const { result } = await renderHook(() => useHeldMatches(IDS));
    expect(held(result)).toEqual(['m1', 'm2']);
    await act(async () => {
      jest.advanceTimersByTime(5 * MIN + 200);
    });
    expect(held(result)).toEqual(['m1']);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(held(result)).toEqual([]);
  });
});
