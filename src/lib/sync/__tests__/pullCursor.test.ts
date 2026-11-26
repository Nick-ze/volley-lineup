/**
 * v10 audit (docs/AUDIT_V10.md H4): the pull cursor of a pull that needs several pages. The
 * 10 s overlap ("don't move the cursor past rows written in the last 10 s") must be measured
 * from the FIRST page's server time: a write that was still uncommitted when page 1 was read can
 * sit below page 1's newest rows, and page 2 never returns it.
 */
import { teamSlice, type TeamData } from '@/domain/syncRecords';
import { FakeCloud } from '@/test-utils/fakeBackend';
import { goldenTeamData } from '@/test-utils/syncFixtures';
import { TestDevice } from '@/test-utils/syncDevice';

import { downloadTeams, uploadTeams } from '../teamCommands';
import { PULL_PAGE } from '../teamSync';

function t1(): TeamData {
  const slice = teamSlice(goldenTeamData(), 't1');
  if (!slice) throw new Error('no t1');
  return { ...slice, teams: [slice.team] };
}

const iso = (ms: number) => new Date(ms).toISOString();

/** A valid pulled player row. */
const playerRow = (n: number, version: number, updatedAt: number) => ({
  kind: 'player' as const,
  id: `extra-${n}`,
  payload: {
    firstName: 'Extra',
    lastName: `Player ${n}`,
    number: 1,
    positions: ['OH'],
    active: true,
  },
  deleted: false,
  at: iso(updatedAt),
  updated_at: iso(updatedAt),
  version,
  device_id: 'dev-x',
});

describe('the pull cursor over several pages', () => {
  it('keeps the 10 s overlap of the first page, however long the later pages take', async () => {
    const cloud = new FakeCloud();
    const a = new TestDevice(cloud, 'dev-a', t1());
    const b = new TestDevice(cloud, 'dev-b');
    await a.signIn('anna@example.test');
    await b.signIn('anna@example.test');
    await a.act((e) => uploadTeams(e, ['t1']));
    await a.cycle();
    await b.act((e) => downloadTeams(e, ['t1']));
    cloud.clock.tick(60_000);
    await b.cycle();
    const start = b.data.sync.teams.t1.cursor;
    expect(start).toBeGreaterThan(0);

    // The server now has two pages of new rows. Page 1 is read at S1: its rows were written 5 s
    // before (another push, version `start + 3`, is still uncommitted then). Page 2 is read 30 s
    // later (a slow connection).
    const s1 = cloud.clock.ms;
    const page1 = Array.from({ length: PULL_PAGE }, (_, i) =>
      // Version start + 3 is missing: its transaction hasn't committed yet.
      playerRow(i, start + 1 + (i < 2 ? i : i + 1), s1 - 5000),
    );
    const top1 = start + 1 + PULL_PAGE;
    const page2 = [playerRow(PULL_PAGE, top1 + 1, s1 + 1000)];
    const pages = [
      { serverNow: iso(s1), rows: page1 },
      { serverNow: iso(s1 + 30_000), rows: page2 },
    ];
    const afters: number[] = [];
    b.backend.pullChanges = async (_teamId, after) => {
      afters.push(after);
      return pages[afters.length - 1] ?? { serverNow: iso(s1 + 30_000), rows: [] };
    };
    b.backend.pushRecords = async () => [];
    await b.cycle();

    expect(afters.slice(0, 2)).toEqual([start, top1]);
    // Every row of page 1 is younger than S1 − 10 s: the cursor must not pass any of them, so
    // the next pull starts below the uncommitted version and gets it.
    expect(b.data.sync.teams.t1.cursor).toBe(start);
  });
});
