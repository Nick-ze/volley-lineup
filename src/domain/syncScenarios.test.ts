/**
 * v10: two (or three) devices syncing one team through a fake server that applies the server's
 * rules (later `(at, device_id)` wins, clamped times, a version sequence). The devices only use
 * the pure sync functions, like the engine does: detect → pull + merge → push.
 */
import {
  Clock,
  emptyTeamData,
  FakeDevice,
  FakeServer,
  goldenTeamData,
  linkedTeam,
  sliceTransfer,
} from '@/test-utils/syncFixtures';

import { isConsistent } from './exportConsistency';
import { detectChanges } from './syncChanges';
import { adoptExisting, resetToCloudMerge } from './syncMerge';
import { sliceToRecords, type TeamData, type TeamSlice } from './syncRecords';
import { parseRemoteRow, type RemoteRecord } from './syncSchema';
import type { LineupPreset, Match, Player, SetEvent, SetLineup } from './types';

const recordsOf = (d: FakeDevice) => Object.fromEntries(sliceToRecords(d.slice as TeamSlice));
const pending = (d: FakeDevice) => detectChanges(d.slice, d.sync, '').changes.length;

function expectConverged(...devices: FakeDevice[]) {
  for (const d of devices) {
    expect(pending(d)).toBe(0);
    expect(recordsOf(d)).toEqual(recordsOf(devices[0]));
    expect(isConsistent(sliceTransfer(d.slice as TeamSlice))).toBe(true);
  }
}

/** A uploads the golden team t1; B downloads it. */
function setup() {
  const clock = new Clock();
  const server = new FakeServer(clock);
  const a = new FakeDevice('devA', server, clock, 't1', goldenTeamData(), linkedTeam(), 'pr1');
  a.cycle();
  clock.tick(20_000);
  const b = new FakeDevice('devB', server, clock, 't1', emptyTeamData(), linkedTeam(), 'prB');
  b.cycle();
  clock.tick(20_000);
  return { clock, server, a, b };
}

/** Changes the data now and notes the change (the engine does this 1.5 s after a change). */
function edit(d: FakeDevice, clock: Clock, fn: (data: TeamData) => TeamData) {
  d.edit(fn);
  d.detect();
  clock.tick(1000);
}

const renamePlayer =
  (id: string, firstName: string) =>
  (d: TeamData): TeamData => ({
    ...d,
    players: d.players.map((p) => (p.id === id ? { ...p, firstName } : p)),
  });
const renameTeam = (name: string) => (d: TeamData) => ({
  ...d,
  teams: d.teams.map((t) => (t.id === 't1' ? { ...t, name } : t)),
});
const changeMatch = (id: string, patch: Partial<Match>) => (d: TeamData) => ({
  ...d,
  matches: d.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)),
});
/** The store's `deleteSeason`: the season, its opponents and its matches. */
const deleteSeason = (id: string) => (d: TeamData) => ({
  ...d,
  seasons: d.seasons.filter((x) => x.id !== id),
  opponents: d.opponents.filter((o) => o.seasonId !== id),
  matches: d.matches.filter((m) => m.seasonId !== id),
});
const addMatch = (d: TeamData): TeamData => {
  const m2 = d.matches.find((m) => m.id === 'm2') as Match;
  return { ...d, matches: [...d.matches, { ...m2, id: 'm9', date: '2027-01-09' }] };
};

describe('two devices', () => {
  it('download a whole team exactly (records), each with its own profile', () => {
    const { a, b } = setup();
    expect(recordsOf(b)).toEqual(recordsOf(a));
    expect(b.slice?.team.profileId).toBe('prB');
    expect(a.slice?.team.profileId).toBe('pr1');
    expectConverged(a, b);
  });

  it('pull in pages', () => {
    const { a, server, clock } = setup();
    const c = new FakeDevice('devC', server, clock, 't1', emptyTeamData(), linkedTeam(), 'prC');
    c.pull(false, 5);
    expectConverged(a, c);
  });

  it('agree per record on the later save, whoever pushes first', () => {
    for (const aFirst of [true, false]) {
      const { a, b, clock } = setup();
      edit(a, clock, renamePlayer('p2', 'FromA'));
      edit(b, clock, renamePlayer('p2', 'FromB'));
      edit(b, clock, changeMatch('m1', { date: '2026-11-02' }));
      edit(a, clock, renameTeam('Team A'));
      const [first, second] = aFirst ? [a, b] : [b, a];
      first.cycle();
      second.cycle();
      first.cycle();
      second.cycle();
      for (const d of [a, b]) {
        const slice = d.slice as TeamSlice;
        expect(slice.players[1].firstName).toBe('FromB');
        expect(slice.matches[0].date).toBe('2026-11-02');
        expect(slice.team.name).toBe('Team A');
      }
      expectConverged(a, b);
    }
  });

  it('agree on one value for saves of the same millisecond', () => {
    const tie = () => {
      const env = setup();
      env.a.edit(renamePlayer('p2', 'FromA'));
      env.b.edit(renamePlayer('p2', 'FromB'));
      env.a.detect();
      env.b.detect();
      env.clock.tick(1000);
      return env;
    };
    // Both push before pulling: the server keeps the higher device id, in either order.
    for (const aFirst of [true, false]) {
      const { a, b } = tie();
      const [first, second] = aFirst ? [a, b] : [b, a];
      first.push();
      second.push();
      a.cycle();
      b.cycle();
      expect(a.slice?.players[1].firstName).toBe('FromB');
      expectConverged(a, b);
    }
    // One pulls the other's save first: it takes it (remote wins a tie).
    for (const aFirst of [true, false]) {
      const { a, b } = tie();
      const [first, second] = aFirst ? [a, b] : [b, a];
      first.cycle();
      second.cycle();
      first.cycle();
      expect(a.slice?.players[1].firstName).toBe(aFirst ? 'FromA' : 'FromB');
      expectConverged(a, b);
    }
  });

  it('bring a deleted season back when a newer match was added to it elsewhere', () => {
    const { a, b, clock } = setup();
    edit(a, clock, deleteSeason('s2'));
    edit(b, clock, addMatch);
    a.cycle();
    b.cycle();
    a.cycle();
    for (const d of [a, b]) {
      expect(d.slice?.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
      expect(d.slice?.matches.map((m) => m.id).sort()).toEqual(['m1', 'm9']);
    }
    expectConverged(a, b);
  });

  it('bring back what stays below a resurrected season on every device (three devices)', () => {
    const { a, b, clock, server } = setup();
    const c = new FakeDevice('devC', server, clock, 't1', emptyTeamData(), linkedTeam(), 'prC');
    c.cycle();
    const o4 = { id: 'o4b', seasonId: 's2', name: 'Late club', createdAt: clock.iso() };
    edit(b, clock, (d) => ({ ...d, opponents: [...d.opponents, o4] }));
    b.cycle();
    c.cycle();
    expect(c.slice?.opponents.map((o) => o.id)).toContain('o4b');
    edit(a, clock, deleteSeason('s2'));
    edit(b, clock, addMatch);
    a.cycle();
    c.cycle();
    expect(c.slice?.seasons.map((x) => x.id)).toEqual(['s1']);
    b.cycle();
    a.cycle();
    c.cycle();
    for (const d of [a, b, c]) {
      expect(d.slice?.opponents.map((o) => o.id).sort()).toEqual(['o1', 'o2', 'o3', 'o4b']);
      expect(d.slice?.matches.map((m) => m.id).sort()).toEqual(['m1', 'm9']);
    }
    expectConverged(a, b, c);
  });

  it('let an older match go with a season deleted later (cascade, no tombstones)', () => {
    const { a, b, clock } = setup();
    edit(b, clock, addMatch);
    edit(a, clock, deleteSeason('s2'));
    a.cycle();
    b.cycle();
    a.cycle();
    for (const d of [a, b]) {
      expect(d.slice?.seasons.map((x) => x.id)).toEqual(['s1']);
      expect(d.slice?.matches.map((m) => m.id)).toEqual(['m1']);
    }
    expect(b.sync.edits).toEqual({});
    expectConverged(a, b);
  });

  it('end with one starters (one id) when both made their own', () => {
    for (const aLater of [false, true]) {
      const { a, b, clock } = setup();
      const noStarters = (d: TeamData) => ({
        ...d,
        presets: d.presets.filter((p) => p.kind !== 'starters'),
      });
      edit(a, clock, noStarters);
      a.cycle();
      b.cycle();
      clock.tick(20_000);
      const starters =
        (id: string, liberoId: string) =>
        (d: TeamData): TeamData => {
          const named = d.presets.find((p) => p.id === 'ps2') as LineupPreset;
          const own: LineupPreset = { ...named, id, kind: 'starters', name: '', liberoId };
          return { ...d, presets: [...d.presets, own] };
        };
      const [early, late] = aLater ? [b, a] : [a, b];
      edit(early, clock, starters(`s-${early.id}`, 'p7'));
      edit(late, clock, starters(`s-${late.id}`, 'p8'));
      a.cycle();
      b.cycle();
      a.cycle();
      b.cycle();
      for (const d of [a, b]) {
        const list = (d.slice as TeamSlice).presets.filter((p) => p.kind === 'starters');
        expect(list.map((p) => [p.id, p.liberoId])).toEqual([[`s-${late.id}`, 'p8']]);
      }
      expectConverged(a, b);
    }
  });

  it('never send descriptions or profiles, and keep them on every pull', () => {
    const { a, b, clock, server } = setup();
    const sent = JSON.stringify([...server.rows.values()]);
    expect(sent).not.toContain('description');
    expect(sent).not.toContain('Knee tape');
    expect(sent).not.toContain('profileId');
    expect(b.slice?.players[0]).not.toHaveProperty('description');
    edit(b, clock, renamePlayer('p1', 'Anne'));
    edit(b, clock, renameTeam('B team'));
    b.cycle();
    a.cycle();
    const p1 = a.slice?.players[0];
    expect(p1).toMatchObject({ firstName: 'Anne', description: 'Strong serve. Knee tape.' });
    expect(a.slice?.team).toMatchObject({ name: 'B team', profileId: 'pr1' });
  });

  it('skip a record whose id another local team uses', () => {
    const { a, server, clock } = setup();
    const c = new FakeDevice('devC', server, clock, 't1', goldenTeamData(), linkedTeam(), 'prC');
    c.edit((d) => ({ ...d, teams: d.teams.filter((t) => t.id !== 't1') }));
    c.edit((d) => ({ ...d, players: d.players.filter((p) => p.teamId !== 't1') }));
    c.edit((d) => ({ ...d, matches: d.matches.filter((m) => m.teamId !== 't1') }));
    c.edit((d) => ({ ...d, presets: [], seasons: d.seasons.filter((x) => x.teamId !== 't1') }));
    c.edit((d) => ({ ...d, opponents: d.opponents.filter((o) => o.seasonId === 's3') }));
    edit(a, clock, (d) => ({
      ...d,
      players: [...d.players, { ...d.players[1], id: 'p9', number: 99 }],
    }));
    a.cycle();
    c.pull();
    expect(c.skipped).toEqual([{ key: 'player:p9', reason: 'foreignId' }]);
    expect(c.data.players.filter((p) => p.id === 'p9').map((p) => p.teamId)).toEqual(['t2']);
    expect(c.slice?.players.map((p) => p.id)).not.toContain('p9');
  });

  it('re-read rows written in the last 10 s, so a late commit is not missed', () => {
    const { a, b, clock, server } = setup();
    edit(a, clock, renamePlayer('p3', 'Late'));
    a.push();
    server.uncommitted.add('player:p3');
    clock.tick(1000);
    edit(a, clock, renamePlayer('p4', 'Early'));
    a.push();
    b.pull();
    expect(b.slice?.players[3].firstName).toBe('Early');
    expect(b.slice?.players[2].firstName).not.toBe('Late');
    const cursor = b.sync.cursor;
    expect(cursor).toBeLessThan(server.version - 1);
    server.uncommitted.clear();
    clock.tick(3000);
    const before = b.data;
    b.pull();
    expect(b.slice?.players[2].firstName).toBe('Late');
    expect(b.data.players[3]).toBe(before.players[3]);
    clock.tick(20_000);
    b.pull();
    expect(b.sync.cursor).toBe(server.version);
    expectConverged(a, b);
  });

  it('change nothing when nothing changed (same objects, nothing to push)', () => {
    const { a, b } = setup();
    a.cycle();
    b.cycle();
    const [dataA, dataB, syncB] = [a.data, b.data, b.sync.edits];
    a.cycle();
    b.cycle();
    expect(a.data).toBe(dataA);
    expect(b.data).toBe(dataB);
    expect(b.sync.edits).toBe(syncB);
    expect(a.push()).toEqual([]);
  });

  it('merge seasons both created offline with the same name', () => {
    const { a, b, clock } = setup();
    const addSeason = (id: string) => (d: TeamData) => ({
      ...d,
      seasons: [
        ...d.seasons,
        {
          id,
          teamId: 't1',
          name: 'Halle 2027',
          kind: 'tournament' as const,
          createdAt: clock.iso(),
        },
      ],
    });
    edit(a, clock, addSeason('sA'));
    edit(b, clock, addSeason('sB'));
    a.cycle();
    b.cycle();
    a.cycle();
    b.cycle();
    for (const d of [a, b]) {
      expect(d.slice?.seasons.map((x) => x.id)).toEqual(['s1', 's2', 'sA']);
    }
    expect(b.issues).toEqual([]);
    expectConverged(a, b);
  });

  it('never push from a viewer; the server always wins there', () => {
    const { a, b, clock } = setup();
    b.sync = { ...b.sync, role: 'player' };
    edit(b, clock, renamePlayer('p2', 'Viewer'));
    expect(b.push()).toEqual([]);
    edit(a, clock, renamePlayer('p2', 'Manager'));
    a.cycle();
    b.cycle();
    expect(b.slice?.players[1].firstName).toBe('Manager');
  });
});

describe('linking and demotion', () => {
  it('links an existing local copy: the cloud wins, local-only records are pushed', () => {
    const { a, server, clock } = setup();
    edit(a, clock, renamePlayer('p2', 'Cloud'));
    a.cycle();
    const copy = goldenTeamData();
    const local = {
      ...renamePlayer('p2', 'Old copy')(copy),
      players: [...copy.players, { ...copy.players[1], id: 'p20', number: 20 }],
    };
    const c = new FakeDevice('devC', server, clock, 't1', local, linkedTeam(), 'prC');
    c.sync = { ...c.sync, edits: adoptExisting(c.slice as TeamSlice) };
    c.cycle();
    a.cycle();
    expect(c.slice?.players[1].firstName).toBe('Cloud');
    expect(a.slice?.players.map((p) => p.id)).toContain('p20');
    expectConverged(a, c);
  });

  it('undoes unsynced changes after a demotion (cloudWins from version 0)', () => {
    const { a, b, clock } = setup();
    edit(b, clock, renamePlayer('p2', 'Unsynced'));
    edit(b, clock, (d) => ({
      ...d,
      players: [...d.players, { ...d.players[1], id: 'p20', number: 20 }],
    }));
    b.sync = { ...b.sync, role: 'player', cursor: 0, edits: {} };
    b.pull(true);
    expect(recordsOf(b)).toEqual(recordsOf(a));
  });
});

/** Review #90 regressions: a device that merely lacks something must never push the loss. */
describe('review regressions', () => {
  const addP10 = (d: TeamData): TeamData => ({
    ...d,
    players: [...d.players, { ...(d.players[1] as Player), id: 'p10', number: 30 }],
  });
  const dropPlayer = (id: string) => (d: TeamData) => ({
    ...d,
    players: d.players.filter((p) => p.id !== id),
  });
  const mapSet = (matchId: string, n: number, fn: (s: SetLineup) => SetLineup) => (d: TeamData) =>
    changeMatch(matchId, {
      sets: (d.matches.find((m) => m.id === matchId) as Match).sets.map((s) =>
        s.setNumber === n ? fn(s) : s,
      ),
    })(d);
  const run = (...devices: FakeDevice[]) => devices.forEach((d) => d.cycle());

  it('S2: a player deleted offline on A, subbed into a played set on B: the history stays', () => {
    const { a, b, clock } = setup();
    edit(a, clock, addP10);
    run(a, b, a);
    clock.tick(20_000);
    edit(a, clock, dropPlayer('p10'));
    clock.tick(10_000);
    const events: SetEvent[] = [
      { type: 'sub', outPlayerId: 'p2', inPlayerId: 'p10' },
      { type: 'point', winner: 'us', kind: 'kill', playerId: 'p10', at: clock.iso() },
    ];
    edit(
      b,
      clock,
      mapSet('m1', 3, (s) => ({ ...s, events })),
    );
    b.cycle();
    clock.tick(5000);
    a.cycle();
    clock.tick(5000);
    run(b, a, b, a);
    for (const d of [a, b]) {
      expect(d.slice?.players.map((p) => p.id)).toContain('p10');
      expect(d.slice?.matches[0].sets[2].events).toEqual(events);
    }
    expectConverged(a, b);
  });

  it('S2c: a captain set on B while A deleted the player keeps the captain', () => {
    for (const extraCycles of [0, 2]) {
      const { a, b, clock } = setup();
      edit(a, clock, dropPlayer('p5'));
      clock.tick(10_000);
      edit(b, clock, (d) => ({ ...d, teams: d.teams.map((t) => ({ ...t, captainId: 'p5' })) }));
      b.cycle();
      clock.tick(5000);
      a.cycle();
      // A syncing again before B is back must not clear B's newer captain.
      for (let i = 0; i < extraCycles; i++) {
        clock.tick(20_000);
        a.cycle();
      }
      run(b, a, b, a);
      for (const d of [a, b]) {
        expect(d.slice?.team.captainId).toBe('p5');
        expect(d.slice?.players.map((p) => p.id)).toContain('p5');
      }
      expectConverged(a, b);
    }
  });

  it('S4: a match deleted offline on A while B scores it: no push loop, the match comes back', () => {
    const { a, b, clock } = setup();
    edit(a, clock, (d) => ({ ...d, matches: d.matches.filter((m) => m.id !== 'm2') }));
    clock.tick(10_000);
    const events: SetEvent[] = [{ type: 'point', winner: 'us' }];
    edit(
      b,
      clock,
      mapSet('m2', 1, (s) => ({ ...s, events })),
    );
    b.cycle();
    clock.tick(5000);
    const pushed: number[] = [];
    for (let i = 0; i < 4; i++) {
      a.detect();
      a.pull();
      pushed.push(a.push().length);
      clock.tick(60_000);
    }
    expect(pushed).toEqual([1, 0, 0, 0]);
    run(b, a, b, a);
    for (const d of [a, b]) expect(d.slice?.matches[1].sets[0].events).toEqual(events);
    expectConverged(a, b);
    expect([a.push(), b.push()]).toEqual([[], []]);
  });

  it('S9b: a reset with a page that lacks the team row changes nothing', () => {
    const { b, server } = setup();
    const page = server
      .pull(5, 5)
      .rows.map(parseRemoteRow)
      .filter((r): r is RemoteRecord => r !== null);
    expect(page.some((r) => r.kind === 'team')).toBe(false);
    const before = b.slice;
    const team = { ...b.sync, role: 'player' as const, cursor: 0, edits: {} };
    const out = resetToCloudMerge({
      teamId: 't1',
      slice: before,
      team,
      rows: page,
      local: { profileId: 'prB' },
      foreignIds: new Set(),
    });
    expect(out.slice).toBe(before);
    expect(out.team).toBe(team);
  });

  it('X1: another local team using a player id: nothing is stripped or pushed', () => {
    const clock = new Clock();
    const server = new FakeServer(clock);
    const owner = new FakeDevice(
      'devA',
      server,
      clock,
      't1',
      goldenTeamData(),
      linkedTeam(),
      'pr1',
    );
    owner.cycle();
    clock.tick(20_000);
    const set1Before = JSON.stringify(server.rows.get('set:m1/1')?.payload);
    const local: TeamData = {
      ...emptyTeamData(),
      teams: [{ id: 'tx', profileId: 'prX', name: 'local', createdAt: '2026-01-01' }],
      players: [
        {
          id: 'p1',
          teamId: 'tx',
          firstName: 'L',
          lastName: 'L',
          number: 1,
          positions: ['OH'],
          active: true,
        },
      ],
    };
    const x = new FakeDevice('devX', server, clock, 't1', local, linkedTeam(), 'prX');
    x.cycle();
    clock.tick(20_000);
    x.cycle();
    expect(x.skipped).toContainEqual({ key: 'player:p1', reason: 'foreignId' });
    expect([...server.rows.values()].filter((r) => r.deviceId === 'devX')).toEqual([]);
    expect(JSON.stringify(server.rows.get('set:m1/1')?.payload)).toBe(set1Before);
    expect(x.slice?.team.captainId).toBe('p3');
    expect(x.slice?.matches[0].sets[0].slots[1]).toBe('p1');
    expect(x.data.players.find((p) => p.id === 'p1')?.teamId).toBe('tx');
  });
});
