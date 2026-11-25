import { goldenTeamData, sliceOf } from '@/test-utils/syncFixtures';

import { sliceToRecords } from './syncRecords';
import { normalizeTimestamp, parsePayload, parseRemoteRow } from './syncSchema';

const records = sliceToRecords(sliceOf(goldenTeamData(), 't1'));
const payload = (key: string) => records.get(key) as Record<string, unknown>;

describe('normalizeTimestamp', () => {
  it('reads ISO and Postgres timestamps as UTC with milliseconds', () => {
    expect(normalizeTimestamp('2026-11-26T10:00:00.123Z')).toBe('2026-11-26T10:00:00.123Z');
    expect(normalizeTimestamp('2026-11-26T10:00:00.123456+00:00')).toBe('2026-11-26T10:00:00.123Z');
    expect(normalizeTimestamp('2026-11-26 12:00:00+02')).toBe('2026-11-26T10:00:00.000Z');
    expect(normalizeTimestamp('2026-11-26T15:30:00.5+0530')).toBe('2026-11-26T10:00:00.500Z');
    expect(normalizeTimestamp('2026-11-26T05:00:00-05:00')).toBe('2026-11-26T10:00:00.000Z');
  });

  it('rejects anything else', () => {
    for (const bad of [
      '',
      'yesterday',
      '2026-11-26',
      '2026-11-26T10:00:00',
      '2026-13-01T00:00:00Z',
    ]) {
      expect(normalizeTimestamp(bad)).toBeNull();
    }
  });
});

describe('parsePayload', () => {
  it('accepts every kind of record the app produces', () => {
    for (const [key, value] of records) {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      expect(parsePayload(kind as never, id, value)).toEqual(value);
    }
  });

  it('drops unknown and device-only fields', () => {
    expect(
      parsePayload('player', 'p1', { ...payload('player:p1'), description: 'x', extra: 1 }),
    ).toEqual(payload('player:p1'));
    expect(parsePayload('team', 't1', { ...payload('team:t1'), profileId: 'pr1' })).toEqual(
      payload('team:t1'),
    );
  });

  it('rejects invalid payloads', () => {
    expect(parsePayload('player', 'p1', { ...payload('player:p1'), number: -1 })).toBeNull();
    expect(parsePayload('player', 'p1', null)).toBeNull();
    expect(parsePayload('opponent', 'o1', { name: 'x' })).toBeNull();
    expect(
      parsePayload('preset', 'ps2', { ...payload('preset:ps2'), kind: 'starters' }),
    ).toBeNull();
    const { presetId: _presetId, ...noId } = payload('starters:t1');
    expect(parsePayload('starters', 't1', noId)).toBeNull();
  });

  it('checks that a set id matches its set number', () => {
    expect(parsePayload('set', 'm1/2', payload('set:m1/2'))).not.toBeNull();
    expect(parsePayload('set', 'm1/3', payload('set:m1/2'))).toBeNull();
    expect(parsePayload('set', 'm1', payload('set:m1/2'))).toBeNull();
  });
});

describe('parseRemoteRow', () => {
  const row = {
    kind: 'player',
    id: 'p1',
    payload: payload('player:p1'),
    deleted: false,
    at: '2026-11-26T10:00:00.123456+00:00',
    updated_at: '2026-11-26T10:00:01.5+00:00',
    version: 42,
    device_id: 'dev2',
  };

  it('reads a row of pull_changes', () => {
    expect(parseRemoteRow(row)).toEqual({
      kind: 'player',
      id: 'p1',
      payload: payload('player:p1'),
      deleted: false,
      at: '2026-11-26T10:00:00.123Z',
      updatedAt: '2026-11-26T10:00:01.500Z',
      version: 42,
      deviceId: 'dev2',
    });
    const { device_id: _deviceId, ...noDevice } = row;
    expect(parseRemoteRow(noDevice)?.deviceId).toBe('');
  });

  it('reads tombstones (no payload) except for the team', () => {
    expect(parseRemoteRow({ ...row, deleted: true, payload: null })).toMatchObject({
      deleted: true,
      payload: null,
    });
    expect(parseRemoteRow({ ...row, deleted: true })).toBeNull();
    expect(
      parseRemoteRow({ ...row, kind: 'team', id: 't1', deleted: true, payload: null }),
    ).toBeNull();
  });

  it('rejects broken rows', () => {
    expect(parseRemoteRow(null)).toBeNull();
    expect(parseRemoteRow('row')).toBeNull();
    expect(parseRemoteRow({ ...row, kind: 'coach' })).toBeNull();
    expect(parseRemoteRow({ ...row, id: '' })).toBeNull();
    expect(parseRemoteRow({ ...row, id: 'x'.repeat(201) })).toBeNull();
    expect(parseRemoteRow({ ...row, at: 'soon' })).toBeNull();
    expect(parseRemoteRow({ ...row, updated_at: 1 })).toBeNull();
    expect(parseRemoteRow({ ...row, version: -1 })).toBeNull();
    expect(parseRemoteRow({ ...row, version: 1.5 })).toBeNull();
    expect(parseRemoteRow({ ...row, deleted: 'no' })).toBeNull();
    expect(parseRemoteRow({ ...row, payload: { firstName: 'A' } })).toBeNull();
    expect(parseRemoteRow({ ...row, device_id: 'd'.repeat(65) })).toBeNull();
  });
});
