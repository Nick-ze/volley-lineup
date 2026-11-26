import { emptyTeamData, goldenTeamData, sliceOf } from '@/test-utils/syncFixtures';

import {
  foreignKeys,
  matchOfRecord,
  parseRecordKey,
  parseSetRecordId,
  payloadHash,
  recordKey,
  recordsToSlice,
  replaceTeamSlice,
  setRecordId,
  sliceToRecords,
  stableStringify,
  teamSlice,
  type RecordPayload,
  type TeamSlice,
  playerRecordHash,
  teamRecordHash,
} from './syncRecords';
import type { LineupPreset } from './types';

const descriptionsOf = (slice: TeamSlice) =>
  new Map(
    slice.players.flatMap((p) => (p.description === undefined ? [] : [[p.id, p.description]])),
  );

const roundTrip = (slice: TeamSlice, previous?: TeamSlice) =>
  recordsToSlice(slice.team.id, sliceToRecords(slice), {
    profileId: slice.team.profileId,
    descriptions: descriptionsOf(slice),
    previous,
  });

describe('record keys', () => {
  it('joins and splits kind and id', () => {
    expect(recordKey('player', 'p1')).toBe('player:p1');
    expect(parseRecordKey('player:p1')).toEqual({ kind: 'player', id: 'p1' });
    expect(parseRecordKey('set:m:1/2')).toEqual({ kind: 'set', id: 'm:1/2' });
  });

  it('rejects keys that are not records', () => {
    expect(parseRecordKey('player')).toBeNull();
    expect(parseRecordKey('coach:x')).toBeNull();
    expect(parseRecordKey('player:')).toBeNull();
  });

  it('set ids are <matchId>/<n>', () => {
    expect(setRecordId('m1', 3)).toBe('m1/3');
    expect(parseSetRecordId('m1/3')).toEqual({ matchId: 'm1', setNumber: 3 });
    expect(parseSetRecordId('a/b/5')).toEqual({ matchId: 'a/b', setNumber: 5 });
    for (const bad of ['m1', '/1', 'm1/6', 'm1/0', 'm1/x', 'm1/12']) {
      expect(parseSetRecordId(bad)).toBeNull();
    }
  });

  it('matchOfRecord: a match and its sets belong to the match, nothing else does', () => {
    expect(matchOfRecord('match', 'm1')).toBe('m1');
    expect(matchOfRecord('set', 'm1/3')).toBe('m1');
    expect(matchOfRecord('set', 'a/b/5')).toBe('a/b');
    expect(matchOfRecord('set', 'm1')).toBeNull();
    for (const kind of ['team', 'season', 'opponent', 'player', 'preset', 'starters'] as const) {
      expect(matchOfRecord(kind, 'm1')).toBeNull();
    }
  });
});

describe('stableStringify and payloadHash', () => {
  it('sorts keys, drops undefined properties and keeps array positions', () => {
    expect(stableStringify({ b: 1, a: [1, undefined, 'x'], c: undefined, d: null })).toBe(
      '{"a":[1,null,"x"],"b":1,"d":null}',
    );
    expect(stableStringify({ z: { y: true, x: false } })).toBe('{"z":{"x":false,"y":true}}');
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify(Symbol('s'))).toBe('null');
    expect(stableStringify('a"b')).toBe('"a\\"b"');
    expect(stableStringify(Number.NaN)).toBe('null');
  });

  it('hashes to 14 hex digits, the same for the same content in any key order', () => {
    const a = payloadHash({ x: 1, y: [1, 2] });
    expect(a).toMatch(/^[0-9a-f]{14}$/);
    expect(payloadHash({ y: [1, 2], x: 1 })).toBe(a);
    expect(payloadHash({ x: 2, y: [1, 2] })).not.toBe(a);
    expect(payloadHash({})).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe('teamSlice', () => {
  it('collects a team and everything that belongs to it', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    expect(slice.team.id).toBe('t1');
    expect(slice.players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
    ]);
    expect(slice.seasons.map((x) => x.id)).toEqual(['s1', 's2']);
    expect(slice.opponents.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(slice.matches.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(slice.presets.map((p) => p.id)).toEqual(['ps1', 'ps2']);
  });

  it('is undefined for a team that is not there', () => {
    expect(teamSlice(goldenTeamData(), 'nope')).toBeUndefined();
  });
});

describe('sliceToRecords', () => {
  const slice = sliceOf(goldenTeamData(), 't1');
  const records = sliceToRecords(slice);

  it('has one record per team, season, opponent, player, match, set, preset and the starters', () => {
    expect([...records.keys()]).toEqual([
      'team:t1',
      'season:s1',
      'season:s2',
      'opponent:o1',
      'opponent:o2',
      'opponent:o3',
      'player:p1',
      'player:p2',
      'player:p3',
      'player:p4',
      'player:p5',
      'player:p6',
      'player:p7',
      'player:p8',
      'match:m1',
      'match:m2',
      'set:m1/1',
      'set:m1/2',
      'set:m1/3',
      'set:m2/1',
      'starters:t1',
      'preset:ps2',
    ]);
  });

  it('leaves out keys and device-only fields', () => {
    expect(records.get('team:t1')).not.toHaveProperty('id');
    expect(records.get('team:t1')).not.toHaveProperty('profileId');
    expect(records.get('team:t1')).toHaveProperty('captainId', 'p3');
    const player = records.get('player:p1');
    expect(player).toEqual({
      firstName: 'Anna',
      lastName: 'Meier',
      number: 7,
      positions: ['S', 'OPP'],
      active: true,
      photoId: 'ph2',
    });
    expect(records.get('season:s1')).not.toHaveProperty('teamId');
    expect(records.get('opponent:o1')).toEqual({
      seasonId: 's1',
      name: 'Rivals',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(records.get('match:m1')).not.toHaveProperty('sets');
    expect(records.get('match:m1')).not.toHaveProperty('teamId');
    expect(records.get('set:m1/2')).toBe(slice.matches[0].sets[1]);
    expect(records.get('preset:ps2')).toMatchObject({ kind: 'preset', name: 'Strong serve' });
    expect(records.get('preset:ps2')).not.toHaveProperty('teamId');
  });

  it('keys the starters by the team and carries its id and creation time', () => {
    const starters = records.get('starters:t1');
    expect(starters).toMatchObject({ presetId: 'ps1', createdAt: '2026-01-05T00:00:00.000Z' });
    expect(starters).not.toHaveProperty('kind');
    expect(starters).not.toHaveProperty('id');
  });

  it('caches payloads per entity object', () => {
    const again = sliceToRecords(slice);
    for (const [key, payload] of records) expect(again.get(key)).toBe(payload);
  });

  it('only takes the first starters of a team', () => {
    const second: LineupPreset = { ...slice.presets[0], id: 'ps9', name: 'second' };
    const recs = sliceToRecords({ ...slice, presets: [...slice.presets, second] });
    expect(recs.get('starters:t1')).toMatchObject({ presetId: 'ps1' });
  });
});

describe('recordsToSlice', () => {
  it('round-trips both golden teams exactly', () => {
    const data = goldenTeamData();
    for (const teamId of ['t1', 't2']) {
      const slice = sliceOf(data, teamId);
      expect(roundTrip(slice)).toEqual(slice);
    }
  });

  it('puts the profile and the descriptions back', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const built = recordsToSlice('t1', sliceToRecords(slice), {
      profileId: 'other',
      descriptions: new Map([['p2', 'Quick']]),
    });
    expect(built.team.profileId).toBe('other');
    expect(built.players[0]).not.toHaveProperty('description');
    expect(built.players[1].description).toBe('Quick');
  });

  it('keeps the previous objects of unchanged entities', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const built = roundTrip(slice, slice);
    expect(built.team).toBe(slice.team);
    built.players.forEach((p, i) => expect(p).toBe(slice.players[i]));
    built.seasons.forEach((x, i) => expect(x).toBe(slice.seasons[i]));
    built.opponents.forEach((o, i) => expect(o).toBe(slice.opponents[i]));
    built.matches.forEach((m, i) => expect(m).toBe(slice.matches[i]));
    built.presets.forEach((p, i) => expect(p).toBe(slice.presets[i]));
  });

  it('reuses an entity when an equal payload arrives as a new object', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = new Map(sliceToRecords(slice));
    const copy = (key: string) =>
      records.set(key, JSON.parse(JSON.stringify(records.get(key))) as RecordPayload);
    copy('player:p2');
    copy('set:m1/1');
    copy('match:m2');
    const built = recordsToSlice('t1', records, {
      profileId: 'x',
      descriptions: new Map(),
      previous: slice,
    });
    expect(built.players[1]).toBe(slice.players[1]);
    expect(built.matches[0]).toBe(slice.matches[0]);
    expect(built.matches[1]).toBe(slice.matches[1]);
  });

  it('builds new objects for changed entities, a match when a set changed, new ones last', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = new Map(sliceToRecords(slice));
    records.set('player:p2', { ...records.get('player:p2'), firstName: 'Bea' });
    const set = records.get('set:m2/1') as RecordPayload;
    records.set('set:m2/1', { ...set, weServeFirst: !set.weServeFirst });
    records.set('player:p20', { ...records.get('player:p3'), number: 20 });
    records.delete('player:p8');
    const built = recordsToSlice('t1', records, {
      profileId: 'x',
      descriptions: descriptionsOf(slice),
      previous: slice,
    });
    expect(built.players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p20',
    ]);
    expect(built.players[1]).toEqual({ ...slice.players[1], firstName: 'Bea' });
    expect(built.players[0]).toBe(slice.players[0]);
    expect(built.matches[0]).toBe(slice.matches[0]);
    expect(built.matches[1]).not.toBe(slice.matches[1]);
    expect(built.matches[1].sets[0].weServeFirst).toBe(!set.weServeFirst);
  });

  it('adopts the starters id the records carry', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = new Map(sliceToRecords(slice));
    records.set('starters:t1', { ...records.get('starters:t1'), presetId: 'psX' });
    const built = recordsToSlice('t1', records, {
      profileId: 'x',
      descriptions: new Map(),
      previous: slice,
    });
    expect(built.presets[0]).toEqual({ ...slice.presets[0], id: 'psX' });
  });

  it('matches only the first starters of the previous team', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const second: LineupPreset = { ...slice.presets[0], id: 'ps9' };
    const previous = { ...slice, presets: [...slice.presets, second] };
    const built = roundTrip(slice, previous);
    expect(built.presets[0]).toBe(slice.presets[0]);
    expect(built.presets).toHaveLength(2);
  });

  it('sorts sets by number and ignores keys that are not records', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = new Map<string, RecordPayload>();
    const all = sliceToRecords(slice);
    for (const key of ['team:t1', 'opponent:o1', 'match:m1', 'set:m1/3', 'set:m1/1', 'set:m1/2']) {
      records.set(key, all.get(key) as RecordPayload);
    }
    records.set('nonsense', {});
    records.set('set:bad', {});
    const built = recordsToSlice('t1', records, { profileId: 'x', descriptions: new Map() });
    expect(built.matches[0].sets.map((s) => s.setNumber)).toEqual([1, 2, 3]);
  });

  it('keeps the previous team without a team record, and needs one without a previous', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = new Map(sliceToRecords(slice));
    records.delete('team:t1');
    const local = { profileId: 'x', descriptions: new Map<string, string>() };
    expect(recordsToSlice('t1', records, { ...local, previous: slice }).team).toBe(slice.team);
    expect(() => recordsToSlice('t1', records, local)).toThrow('no team record');
  });

  it('builds a match without sets when none are there', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const all = sliceToRecords(slice);
    const records = new Map([
      ['team:t1', all.get('team:t1') as RecordPayload],
      ['match:m2', all.get('match:m2') as RecordPayload],
    ]);
    expect(
      recordsToSlice('t1', records, { profileId: 'x', descriptions: new Map() }).matches[0].sets,
    ).toEqual([]);
  });
});

describe('replaceTeamSlice', () => {
  it('returns the same data when nothing changed', () => {
    const data = goldenTeamData();
    expect(replaceTeamSlice(data, 't1', sliceOf(data, 't1'))).toBe(data);
  });

  it('replaces changed entities in place, appends new ones and drops removed ones', () => {
    const data = goldenTeamData();
    const slice = sliceOf(data, 't1');
    const renamed = { ...slice.players[1], firstName: 'Bea' };
    const added = { ...slice.players[2], id: 'p20', number: 20 };
    const next = replaceTeamSlice(data, 't1', {
      ...slice,
      players: [slice.players[0], renamed, ...slice.players.slice(2, 7), added],
    });
    expect(next.players.map((p) => p.id)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p9',
      'p20',
    ]);
    expect(next.players[1]).toBe(renamed);
    expect(next.players[7]).toBe(data.players[8]);
    expect(next.teams).toBe(data.teams);
    expect(next.matches).toBe(data.matches);
  });

  it('removes the whole team for no slice and adds a team that was not there', () => {
    const data = goldenTeamData();
    const slice = sliceOf(data, 't1');
    const without = replaceTeamSlice(data, 't1', undefined);
    expect(without.teams.map((t) => t.id)).toEqual(['t2']);
    expect(without.players.map((p) => p.id)).toEqual(['p9']);
    expect(without.opponents.map((o) => o.id)).toEqual(['o4']);
    expect(without.presets).toEqual([]);
    const back = replaceTeamSlice(without, 't1', slice);
    expect(sliceOf(back, 't1')).toEqual(slice);
    expect(replaceTeamSlice(emptyTeamData(), 'x', undefined)).toEqual(emptyTeamData());
  });
});

describe('foreignKeys', () => {
  it('lists the entity keys of the other teams only', () => {
    const keys = foreignKeys(goldenTeamData(), 't1');
    expect([...keys].sort()).toEqual(['match:m3', 'opponent:o4', 'player:p9', 'season:s3']);
    expect(foreignKeys(goldenTeamData(), 'gone')).toContain('player:p1');
  });
});

describe('playerRecordHash / teamRecordHash (audit M18)', () => {
  it('are the hashes of the records `sliceToRecords` builds', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const records = sliceToRecords(slice);
    for (const player of slice.players) {
      const payload = records.get(recordKey('player', player.id));
      expect(playerRecordHash(player)).toBe(payload && payloadHash(payload));
    }
    const team = records.get(recordKey('team', 't1'));
    expect(teamRecordHash(slice.team)).toBe(team && payloadHash(team));
  });

  it('don’t change with the device-only fields', () => {
    const slice = sliceOf(goldenTeamData(), 't1');
    const player = slice.players[0];
    expect(playerRecordHash({ ...player, description: 'secret' })).toBe(playerRecordHash(player));
    expect(playerRecordHash({ ...player, firstName: 'Other' })).not.toBe(playerRecordHash(player));
    expect(teamRecordHash({ ...slice.team, profileId: 'other' })).toBe(teamRecordHash(slice.team));
  });
});
