import { goldenTeamData, sliceOf, sliceTransfer } from '@/test-utils/syncFixtures';

import { isConsistent } from './exportConsistency';
import { repairSlice } from './syncRepair';
import type { TeamSlice } from './syncRecords';
import type { LineupPreset, Match, Opponent, Season, SetLineup } from './types';

const golden = () => sliceOf(goldenTeamData(), 't1');

const season = (id: string, name: string, createdAt: string): Season => ({
  id,
  teamId: 't1',
  name,
  kind: 'season',
  createdAt,
});
const opponent = (id: string, seasonId: string, name: string, createdAt: string): Opponent => ({
  id,
  seasonId,
  name,
  createdAt,
});
const emptySet = (overrides: Partial<SetLineup> = {}): SetLineup => ({
  setNumber: 1,
  slots: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
  liberoId: null,
  weServeFirst: false,
  liberoReplaces: [],
  events: [],
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  ...overrides,
});
const match = (id: string, seasonId: string, opponentId: string, name: string): Match => ({
  id,
  teamId: 't1',
  seasonId,
  opponentId,
  opponent: name,
  date: '2026-12-01',
  home: true,
  sets: [emptySet()],
});
const preset = (
  id: string,
  name: string,
  createdAt: string,
  kind: 'preset' | 'starters' = 'preset',
) => ({
  ...(golden().presets[1] as LineupPreset),
  id,
  name,
  kind,
  createdAt,
});

/** The repaired slice must import again (duplicate numbers aside) and stay as it is. */
function expectStable(slice: TeamSlice) {
  const once = repairSlice(slice);
  const twice = repairSlice(once.slice);
  expect(twice.slice).toBe(once.slice);
  expect(twice.issues.filter((i) => i.kind !== 'duplicateNumber')).toEqual([]);
  return once;
}

describe('repairSlice', () => {
  it('leaves a consistent team as it is (same object, no issues)', () => {
    const slice = golden();
    expect(repairSlice(slice)).toEqual({ slice, issues: [] });
    expect(repairSlice(slice).slice).toBe(slice);
  });

  it('merges same-named seasons and opponents into the oldest and moves the matches', () => {
    const base = golden();
    const slice: TeamSlice = {
      ...base,
      seasons: [...base.seasons, season('s9', ' 2026/27', '2026-03-01T00:00:00.000Z')],
      opponents: [
        ...base.opponents,
        opponent('o9', 's9', 'rivals', '2026-03-01T00:00:00.000Z'),
        opponent('o8', 's9', 'Neu', '2026-03-02T00:00:00.000Z'),
      ],
      matches: [...base.matches, match('m9', 's9', 'o9', 'rivals'), match('m8', 's9', 'o8', 'Neu')],
    };
    const { slice: fixed, issues } = expectStable(slice);
    expect(issues).toEqual([
      { kind: 'merged', from: 'season:s9', into: 'season:s1' },
      { kind: 'merged', from: 'opponent:o9', into: 'opponent:o1' },
    ]);
    expect(fixed.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(fixed.opponents.map((o) => [o.id, o.seasonId])).toEqual([
      ['o1', 's1'],
      ['o2', 's1'],
      ['o3', 's2'],
      ['o8', 's1'],
    ]);
    expect(fixed.matches.slice(2).map((m) => [m.seasonId, m.opponentId, m.opponent])).toEqual([
      ['s1', 'o1', 'Rivals'],
      ['s1', 'o8', 'Neu'],
    ]);
    expect(fixed.matches[0]).toBe(base.matches[0]);
    expect(isConsistent(sliceTransfer(fixed))).toBe(true);
  });

  it('breaks ties of the creation time by id', () => {
    const base = golden();
    const at = base.seasons[0].createdAt;
    const slice: TeamSlice = {
      ...base,
      seasons: [season('s0', '2026/27', at), ...base.seasons, season('s5', '2026/27', at)],
    };
    const { slice: fixed, issues } = repairSlice(slice);
    expect(fixed.seasons.map((x) => x.id)).toEqual(['s0', 's2']);
    expect(issues.map((i) => i.kind === 'merged' && i.from)).toEqual(['season:s1', 'season:s5']);
    expect(fixed.opponents.slice(0, 2).map((o) => o.seasonId)).toEqual(['s0', 's0']);
  });

  it("gives every match its opponent's season and name", () => {
    const base = golden();
    const wrong = { ...base.matches[1], seasonId: 's1', opponent: 'Old name' };
    const { slice: fixed } = expectStable({ ...base, matches: [base.matches[0], wrong] });
    expect(fixed.matches[1]).toEqual(base.matches[1]);
  });

  it('keeps a match whose opponent is missing as it is (merge never leaves one)', () => {
    const base = golden();
    const lost = match('m7', 's2', 'gone', 'Gone');
    const slice: TeamSlice = {
      ...base,
      seasons: [...base.seasons, season('s9', '2026/27', '2026-03-01T00:00:00.000Z')],
      matches: [...base.matches, lost, match('m6', 's9', 'gone', 'Gone')],
    };
    const { slice: fixed } = repairSlice(slice);
    expect(fixed.matches[2]).toBe(lost);
    expect(fixed.matches[3]).toMatchObject({
      seasonId: 's1',
      opponentId: 'gone',
      opponent: 'Gone',
    });
  });

  it('removes players who are not in the team from sets, keeping the score', () => {
    const base = golden();
    const slice = { ...base, players: base.players.filter((p) => p.id !== 'p8' && p.id !== 'p1') };
    const { slice: fixed } = expectStable(slice);
    const [set1, set2] = fixed.matches[0].sets;
    expect(set1.slots[1]).toBeNull();
    expect(set1.events.filter((e) => e.type === 'sub')).toEqual([]);
    expect(set1.events.filter((e) => e.type === 'point')).toHaveLength(
      base.matches[0].sets[0].events.filter((e) => e.type === 'point').length,
    );
    expect(set1.events[0]).toEqual({
      type: 'point',
      winner: 'us',
      kind: 'ace',
      at: '2026-11-01T18:00:10.000Z',
    });
    expect(set2.slots[1]).toBeNull();
    expect(fixed.presets[0].slots[1]).toBeNull();
    expect(fixed.presets[1].slots[4]).toBeNull();
    expect(isConsistent(sliceTransfer(fixed))).toBe(true);
  });

  it('puts nobody in two slots, keeps the libero off court and drops incoherent tags', () => {
    const base = golden();
    const broken = emptySet({
      slots: { 1: 'p1', 2: 'p2', 3: 'p1', 4: 'p4', 5: 'p2', 6: null },
      liberoId: 'p4',
      events: [
        { type: 'point', winner: 'us', kind: 'ourError', playerId: 'p1' },
        { type: 'point', winner: 'them', kind: 'opponentAce', errorType: 'serve' },
        { type: 'point', winner: 'us', playerId: 'p2' },
        { type: 'point', winner: 'us', kind: 'kill', playerId: 'p2' },
      ],
    });
    const badPreset = { ...base.presets[1], slots: { ...broken.slots }, liberoId: 'p1' };
    const slice: TeamSlice = {
      ...base,
      matches: [{ ...base.matches[1], sets: [broken] }],
      presets: [base.presets[0], badPreset],
    };
    const { slice: fixed } = expectStable(slice);
    const set = fixed.matches[0].sets[0];
    expect(set.slots).toEqual({ 1: 'p1', 2: 'p2', 3: null, 4: 'p4', 5: null, 6: null });
    expect(set.liberoId).toBeNull();
    expect(set.events).toEqual([
      { type: 'point', winner: 'us' },
      { type: 'point', winner: 'them' },
      { type: 'point', winner: 'us' },
      { type: 'point', winner: 'us', kind: 'kill', playerId: 'p2' },
    ]);
    expect(fixed.presets[1].liberoId).toBeNull();
    expect(isConsistent(sliceTransfer(fixed))).toBe(true);
  });

  it('keeps only the first starters and clears a captain who is not a player', () => {
    const base = golden();
    const slice: TeamSlice = {
      ...base,
      team: { ...base.team, captainId: 'p9' },
      presets: [...base.presets, preset('ps9', '', '2026-02-01T00:00:00.000Z', 'starters')],
    };
    const { slice: fixed } = expectStable(slice);
    expect(fixed.team).not.toHaveProperty('captainId');
    expect(fixed.presets.map((p) => p.id)).toEqual(['ps1', 'ps2']);
    expect(fixed.presets[0]).toBe(base.presets[0]);
  });

  it('gives named presets valid, unique names (the oldest keeps a contested name)', () => {
    const base = golden();
    const long = 'L'.repeat(45);
    const slice: TeamSlice = {
      ...base,
      presets: [
        base.presets[0],
        preset('a', 'Serve', '2026-01-02T00:00:00.000Z'),
        preset('b', ' serve ', '2026-01-03T00:00:00.000Z'),
        preset('c', 'SERVE', '2026-01-04T00:00:00.000Z'),
        preset('d', 'Serve (2)', '2026-01-05T00:00:00.000Z'),
        preset('e', '   ', '2026-01-06T00:00:00.000Z'),
        preset('f', long, '2026-01-07T00:00:00.000Z'),
        preset('g', `${'M'.repeat(40)}`, '2026-01-08T00:00:00.000Z'),
        preset('h', `${'M'.repeat(40)} `, '2026-01-09T00:00:00.000Z'),
      ],
    };
    const { slice: fixed, issues } = expectStable(slice);
    expect(fixed.presets.map((p) => p.name)).toEqual([
      '',
      'Serve',
      'serve (3)',
      'SERVE (4)',
      'Serve (2)',
      '?',
      'L'.repeat(40),
      'M'.repeat(40),
      `${'M'.repeat(36)} (2)`,
    ]);
    expect(issues.map((i) => i.kind === 'renamed' && i.recordKey)).toEqual([
      'preset:b',
      'preset:c',
      'preset:e',
      'preset:f',
      'preset:h',
    ]);
    expect(isConsistent(sliceTransfer(fixed))).toBe(true);
  });

  it('only reports duplicate jersey numbers', () => {
    const base = golden();
    const players = base.players.map((p) =>
      p.id === 'p2' || p.id === 'p3' ? { ...p, number: 7 } : p,
    );
    const extra = { ...base.players[3], id: 'p20', number: 1 };
    const slice = { ...base, players: [...players, extra] };
    const { slice: fixed, issues } = repairSlice(slice);
    expect(fixed).toBe(slice);
    expect(issues).toEqual([{ kind: 'duplicateNumber', numbers: [1, 7] }]);
    expect(isConsistent(sliceTransfer(fixed))).toBe(false);
  });

  it('repairs a thoroughly broken team in one go', () => {
    const base = golden();
    const slice: TeamSlice = {
      ...base,
      team: { ...base.team, captainId: 'p1' },
      players: base.players.slice(1),
      seasons: [...base.seasons, season('s9', 'winter cup', '2026-03-01T00:00:00.000Z')],
      opponents: [...base.opponents, opponent('o9', 's9', 'Cup team', '2026-03-01T00:00:00.000Z')],
      matches: [...base.matches, match('m9', 's2', 'o9', 'x')],
      presets: [...base.presets, preset('z', 'strong SERVE', '2026-03-01T00:00:00.000Z')],
    };
    const { slice: fixed } = expectStable(slice);
    expect(isConsistent(sliceTransfer(fixed))).toBe(true);
    expect(fixed.matches[2]).toMatchObject({
      seasonId: 's2',
      opponentId: 'o3',
      opponent: 'Cup Team',
    });
  });
});
