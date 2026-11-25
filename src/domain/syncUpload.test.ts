import { goldenTeamData, goldenTransfer, sliceOf } from '@/test-utils/syncFixtures';

import { isConsistent } from './exportConsistency';
import { sliceToRecords } from './syncRecords';
import { isServerSafeTeamId, rekeyTeam } from './syncUpload';

describe('isServerSafeTeamId', () => {
  it('accepts plain ids of at most 100 characters', () => {
    for (const ok of [
      't1',
      '.a',
      'a..',
      'a-b_c.d~e',
      '3f2a1c9e-4b6d-4e1f-9a7b-2c8d0e5f6a1b',
      'x'.repeat(100),
    ]) {
      expect(isServerSafeTeamId(ok)).toBe(true);
    }
  });

  it('rejects ids the server or a storage path would not take', () => {
    for (const bad of ['', 'x'.repeat(101), 'a/b', 'a%20b', 'a b', 'Mü', 'a:b', '.', '..', '...']) {
      expect(isServerSafeTeamId(bad)).toBe(false);
    }
  });
});

describe('rekeyTeam', () => {
  it('moves the team and everything of it to the new id', () => {
    const data = goldenTeamData();
    const next = rekeyTeam(data, 't1', 'new-id');
    const slice = sliceOf(next, 'new-id');
    const old = sliceOf(data, 't1');
    expect(slice.team).toEqual({ ...old.team, id: 'new-id' });
    expect(slice.players).toHaveLength(old.players.length);
    expect(slice.seasons).toHaveLength(2);
    expect(slice.opponents).toEqual(old.opponents);
    expect(slice.matches.map((m) => m.teamId)).toEqual(['new-id', 'new-id']);
    expect(slice.presets.map((p) => [p.kind, p.teamId])).toEqual([
      ['starters', 'new-id'],
      ['preset', 'new-id'],
    ]);
    expect(next.teams.find((t) => t.id === 't1')).toBeUndefined();
    expect(sliceToRecords(slice).has('starters:new-id')).toBe(true);
  });

  it('leaves other teams and opponents alone and keeps the data consistent', () => {
    const file = goldenTransfer();
    const next = rekeyTeam(file, 't1', 'new-id');
    expect(next.teams[1]).toBe(file.teams[1]);
    expect(next.players[8]).toBe(file.players[8]);
    expect(next.opponents).toBe(file.opponents);
    expect(next.profiles).toBe(file.profiles);
    expect(isConsistent(next)).toBe(true);
  });

  it('keeps collections without anything of the team', () => {
    const data = goldenTeamData();
    const next = rekeyTeam({ ...data, presets: [] }, 't1', 'x');
    expect(next.presets).toEqual([]);
    expect(rekeyTeam(data, 't2', 'y').presets).toBe(data.presets);
  });

  it('refuses an id another local team already has', () => {
    expect(() => rekeyTeam(goldenTeamData(), 't1', 't2')).toThrow('already used');
  });

  it('changes nothing for a team that is not there or the same id', () => {
    const data = goldenTeamData();
    expect(rekeyTeam(data, 'nope', 'x')).toBe(data);
    expect(rekeyTeam(data, 't1', 't1')).toBe(data);
  });
});
