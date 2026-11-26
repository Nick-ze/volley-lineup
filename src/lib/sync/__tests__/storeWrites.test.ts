/**
 * v10 audit (docs/AUDIT_V10.md M19): a sync cycle that changes nothing writes nothing. zustand's
 * persist rewrites the whole stored data after every `set`, also when the state is the same
 * object, so every cycle used to cost 1 + 2 × (shared teams) full writes — every minute, and
 * every 15 s while a live match is followed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { STORAGE_KEY, useAppStore } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { downloadTeams, uploadTeams } from '../teamCommands';

const T1 = 't1';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

const setItem = jest.mocked(AsyncStorage.setItem);

/** How often the app's stored data was written so far. */
const writes = () => setItem.mock.calls.filter(([key]) => key === STORAGE_KEY).length;

/** The players' first names in the last stored copy of the data. */
function storedNames(): Record<string, string> {
  const last = setItem.mock.calls.filter(([key]) => key === STORAGE_KEY).pop();
  if (!last) throw new Error('nothing stored');
  const stored = JSON.parse(last[1]) as { state: { players: { id: string; firstName: string }[] } };
  return Object.fromEntries(stored.state.players.map((p) => [p.id, p.firstName]));
}

/** Two devices of one manager account sharing t1, both in sync. */
async function inSync() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('anna@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  await b.act((e) => downloadTeams(e, [T1]));
  cloud.clock.tick(60_000);
  await a.cycle();
  await b.cycle();
  return { cloud, a, b };
}

const rename = (d: TestDevice, firstName: string) =>
  d.edit((s) => ({
    players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName } : p)),
  }));

afterEach(() => {
  setItem.mockClear();
});

describe('store writes of a sync cycle (audit M19)', () => {
  it('a cycle with nothing to do writes nothing', async () => {
    const { cloud, a, b } = await inSync();
    for (const device of [a, b]) {
      cloud.clock.tick(60_000);
      await device.act(async (engine) => {
        const before = writes();
        await engine.runCycle();
        expect(writes() - before).toBe(0);
      });
    }
  });

  it('another device’s change is still stored, once, and the next cycle is quiet again', async () => {
    const { cloud, a, b } = await inSync();
    cloud.clock.tick(60_000);
    await rename(a, 'From A');
    await a.cycle();
    cloud.clock.tick(60_000);
    await b.act(async (engine) => {
      const before = writes();
      await engine.runCycle();
      expect(useAppStore.getState().players.find((p) => p.id === 'p1')?.firstName).toBe('From A');
      // The pulled record and its bookkeeping, in one write.
      expect(writes() - before).toBe(1);
      expect(storedNames().p1).toBe('From A');
      const after = writes();
      await engine.runCycle();
      expect(writes() - after).toBe(0);
    });
  });

  it('this device’s own change is stored with its save time and with the push’s answer', async () => {
    const { cloud, a } = await inSync();
    cloud.clock.tick(60_000);
    await a.act(async (engine) => {
      useAppStore.setState((s) => ({
        players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Mine' } : p)),
      }));
      const before = writes();
      await engine.runCycle();
      // Noting the change (its save time) and the push result: two writes, not five.
      expect(writes() - before).toBe(2);
      expect(Object.keys(useAppStore.getState().sync.teams[T1].edits)).toEqual([]);
      expect(cloud.record(T1, 'player', 'p1')?.payload).toMatchObject({ firstName: 'Mine' });
    });
  });

  it('a failed write is repeated even by a cycle that has nothing of its own to store', async () => {
    const { cloud, b } = await inSync();
    cloud.clock.tick(60_000);
    await b.act(async (engine) => {
      // A device setting changes (nothing the sync looks at) and the write fails.
      setItem.mockImplementationOnce(async () => {
        throw new Error('storage full');
      });
      const failed = (
        useAppStore.getState().setChipLabel as unknown as (v: 'name') => Promise<void> | void
      )('name');
      await Promise.resolve(failed).catch(() => undefined);
      const stored = () => {
        const last = setItem.mock.calls.filter(([key]) => key === STORAGE_KEY).pop();
        return (JSON.parse(last?.[1] ?? '{}') as { state?: { chipLabel?: string } }).state
          ?.chipLabel;
      };
      const before = writes();
      await engine.runCycle();
      expect(writes() - before).toBe(1);
      expect(stored()).toBe('name');
      // Stored now: the following cycle is quiet again.
      const after = writes();
      await engine.runCycle();
      expect(writes() - after).toBe(0);
    });
  });
});
