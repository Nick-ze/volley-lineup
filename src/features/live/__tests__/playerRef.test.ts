import type { Player } from '@/domain/types';
import { t } from '@/i18n/en';

import { playerDescription, playerRef } from '../format';

const p = (id: string, number: number, firstName: string, lastName: string): Player => ({
  id,
  teamId: 'team1',
  firstName,
  lastName,
  number,
  positions: ['OH'],
  active: true,
});

describe('live playerRef (v8: first name first)', () => {
  it('is "#7 Anna" with the first name', () => {
    const anna = p('a', 7, 'Anna', 'Meier');
    const byId = new Map([[anna.id, anna]]);
    expect(playerRef(t, byId, 'a')).toBe('#7 Anna');
    expect(playerDescription(t, anna)).toBe('Number 7, Anna Meier, Outside Hitter');
  });

  it('tells teammates with the same first name apart', () => {
    const team = [p('a', 7, 'Anna', 'Meier'), p('b', 9, 'Anna', 'Huber'), p('c', 3, 'Bea', 'X')];
    const byId = new Map(team.map((x) => [x.id, x]));
    expect(playerRef(t, byId, 'a')).toBe('#7 Anna M.');
    expect(playerRef(t, byId, 'b')).toBe('#9 Anna H.');
    expect(playerRef(t, byId, 'c')).toBe('#3 Bea');
  });

  it('is "?" for an unknown player', () => {
    expect(playerRef(t, new Map(), 'x')).toBe(t.live.unknownPlayer);
    expect(playerRef(t, new Map(), null)).toBe(t.live.unknownPlayer);
  });
});
