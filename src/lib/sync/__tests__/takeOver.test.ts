/**
 * v10 QA: "Take over" pulls the team before this device may score, so the previous scorer's
 * last rallies (pushed while this device's copy was a few seconds stale) are never overwritten
 * by this device's later save of the whole set.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import type { SetEvent } from '@/domain/types';
import { useSyncRuntime } from '@/store';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { holdMatch, releaseMatch } from '../holdCommands';
import { createInvite } from '../memberCommands';
import { joinTeam, uploadTeams } from '../teamCommands';

const T1 = 't1';
const M = 'm2';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), T1);
  if (!slice) throw new Error('no t1');
  return {
    ...slice,
    teams: [{ ...slice.team, photoId: undefined }],
    players: slice.players.map((p) => ({ ...p, photoId: undefined })),
  };
}

/** Two managers of the shared team t1 on two devices. */
async function twoManagers() {
  const cloud = new FakeCloud();
  const a = new TestDevice(cloud, 'dev-a', t1());
  const b = new TestDevice(cloud, 'dev-b');
  await a.signIn('anna@example.test');
  await b.signIn('ben@example.test');
  await a.act((e) => uploadTeams(e, [T1]));
  await a.cycle();
  const invite = await a.act((e) => createInvite(e, T1, 'manager', 7));
  if (!invite.ok) throw new Error('no invite');
  await b.act((e) => joinTeam(e, invite.value.code));
  await b.cycle();
  return { cloud, a, b };
}

const events = (d: TestDevice): SetEvent[] =>
  d.data.matches.find((m) => m.id === M)?.sets[0]?.events ?? [];

/** Scores `n` points in set 1 of the match, as the live screen would. */
const score = (d: TestDevice, n: number) =>
  d.edit((s) => ({
    matches: s.matches.map((m) =>
      m.id === M
        ? {
            ...m,
            sets: m.sets.map((x, i) =>
              i === 0
                ? {
                    ...x,
                    events: [
                      ...(x.events ?? []),
                      ...Array.from({ length: n }, () => ({
                        type: 'point' as const,
                        winner: 'us' as const,
                      })),
                    ],
                  }
                : x,
            ),
          }
        : m,
    ),
  }));

describe('take over (v10 QA)', () => {
  it('keeps the previous scorer’s last rallies: every event survives on every device', async () => {
    const { cloud, a, b } = await twoManagers();
    const start = events(a).length;
    expect(events(b)).toHaveLength(start);

    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    await score(a, 2);
    await a.cycle(); // A's two points are on the server; B's copy is now stale.
    expect(events(b)).toHaveLength(start);

    cloud.clock.tick(2000);
    const taken = await b.act((e) => holdMatch(e, T1, M, true));
    expect(taken).toEqual({ ok: true, value: { granted: true } });
    expect(events(b)).toHaveLength(start + 2); // pulled before B may score
    expect(b.runtime.holds[M]?.deviceId).toBe('dev-b');

    cloud.clock.tick(2000);
    await score(b, 1);
    await b.cycle();
    await a.cycle();
    expect(events(a)).toHaveLength(start + 3);
    expect(events(b)).toHaveLength(start + 3);
  });

  it('stays read-only while the pull runs: hold → pull → editable', async () => {
    const { cloud, a, b } = await twoManagers();
    await a.act((e) => holdMatch(e, T1, M));
    await b.act((e) => holdMatch(e, T1, M)); // refused: read-only on B
    expect(b.runtime.holds[M]?.deviceId).not.toBe('dev-b');
    cloud.clock.tick(2000);

    const order: string[] = [];
    const pull = b.backend.pullChanges.bind(b.backend);
    b.backend.pullChanges = async (...args) => {
      order.push(
        `pull, editable here: ${useSyncRuntime.getState().holds[M]?.deviceId === 'dev-b'}`,
      );
      return pull(...args);
    };
    const claim = b.backend.holdMatch.bind(b.backend);
    b.backend.holdMatch = async (...args) => {
      order.push('hold');
      return claim(...args);
    };
    const taken = await b.act((e) => holdMatch(e, T1, M, true));
    expect(taken).toEqual({ ok: true, value: { granted: true } });
    expect(order).toEqual(['hold', 'pull, editable here: false']);
    expect(b.runtime.holds[M]?.deviceId).toBe('dev-b');
  });

  it('a pull that fails (offline) still grants the take-over, after the attempt', async () => {
    const { cloud, a, b } = await twoManagers();
    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    let pulls = 0;
    b.backend.pullChanges = async () => {
      pulls += 1;
      throw new TypeError('Network request failed');
    };
    const taken = await b.act((e) => holdMatch(e, T1, M, true));
    expect(taken).toEqual({ ok: true, value: { granted: true } });
    expect(pulls).toBe(1);
    expect(b.runtime.holds[M]?.deviceId).toBe('dev-b');
  });

  it('an ordinary claim (no take-over) does not pull', async () => {
    const { cloud, b } = await twoManagers();
    const before = cloud.calls.filter((c) => c === 'pullChanges').length;
    const held = await b.act((e) => holdMatch(e, T1, M));
    expect(held).toEqual({ ok: true, value: { granted: true } });
    expect(cloud.calls.filter((c) => c === 'pullChanges').length).toBe(before);
  });

  it('hold commands run in the order called: a release after a take-over leaves no hold', async () => {
    const { cloud, a, b } = await twoManagers();
    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    await b.act(async (e) => {
      void e.runCycle(); // the take-over waits behind this cycle
      const taken = holdMatch(e, T1, M, true);
      // The screen closes meanwhile: its release must not overtake the take-over.
      await releaseMatch(e, T1, M);
      expect(await taken).toEqual({ ok: true, value: { granted: true } });
    });
    expect([...cloud.holds.values()].map((h) => h.deviceId)).not.toContain('dev-b');
    expect(b.runtime.holds[M]?.deviceId).not.toBe('dev-b');
  });

  it('the take-over pull honours a pending reset (the cloud replaces the team), like a cycle', async () => {
    const { cloud, a, b } = await twoManagers();
    await a.act((e) => holdMatch(e, T1, M));
    cloud.clock.tick(2000);
    const cloudName = b.data.players.find((p) => p.id === 'p1')?.firstName;
    // An unsynced change on B, then a demotion-style reset is pending for the team.
    await b.edit((s) => ({
      players: s.players.map((p) => (p.id === 'p1' ? { ...p, firstName: 'Local only' } : p)),
    }));
    b.engine.resetPending.add(T1);
    const taken = await b.act((e) => holdMatch(e, T1, M, true));
    expect(taken).toEqual({ ok: true, value: { granted: true } });
    expect(b.data.players.find((p) => p.id === 'p1')?.firstName).toBe(cloudName);
    expect(b.engine.resetPending.has(T1)).toBe(false);
  });
});
