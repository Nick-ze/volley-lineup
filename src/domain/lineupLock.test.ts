import { applyLineupEdit, isLineupLocked, resetLiveData } from './lineupLock';
import type { SetLineup } from './types';

const base: SetLineup = {
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: true,
  liberoReplaces: ['p3'],
  events: [],
};
const played: SetLineup = { ...base, events: [{ type: 'point', winner: 'us' }] };

describe('lineup lock', () => {
  it('locks a set once it has live events', () => {
    expect(isLineupLocked(base)).toBe(false);
    expect(isLineupLocked(played)).toBe(true);
  });

  it('allows any edit while unlocked', () => {
    const next = { ...base, slots: { ...base.slots, 1: 'p8' } };
    expect(applyLineupEdit(base, next)).toBe(next);
  });

  it('refuses changes to the starting six, the libero and the first serve when locked', () => {
    expect(applyLineupEdit(played, { ...played, slots: { ...played.slots, 1: 'p8' } })).toBe(
      played,
    );
    expect(applyLineupEdit(played, { ...played, slots: { ...played.slots, 6: null } })).toBe(
      played,
    );
    expect(applyLineupEdit(played, { ...played, liberoId: null })).toBe(played);
    expect(applyLineupEdit(played, { ...played, weServeFirst: false })).toBe(played);
  });

  it('refuses formation changes (system, order or setter spot) when locked (v6)', () => {
    const f = played.formation;
    expect(applyLineupEdit(played, { ...played, formation: { ...f, system: '6-2' } })).toBe(played);
    expect(applyLineupEdit(played, { ...played, formation: { ...f, order: 'middle' } })).toBe(
      played,
    );
    expect(applyLineupEdit(played, { ...played, formation: { ...f, setterAt: 4 } })).toBe(played);
    // the same formation in a new object is no change
    const same = { ...played, formation: { ...f } };
    expect(applyLineupEdit(played, same)).toBe(same);
    // unlocked, a formation change goes through
    const fresh = { ...played, events: [] };
    const changed = { ...fresh, formation: { ...f, setterAt: 4 as const } };
    expect(applyLineupEdit(fresh, changed)).toBe(changed);
  });

  it('still allows changing whom the libero replaces, and never drops the events', () => {
    const next = { ...played, liberoReplaces: ['p6'] };
    expect(applyLineupEdit(played, next)).toBe(next);
    const cleared = applyLineupEdit(played, { ...played, liberoReplaces: [], events: [] });
    expect(cleared).toEqual({ ...played, liberoReplaces: [] });
  });

  it('resetLiveData clears the events and unlocks', () => {
    expect(resetLiveData(base)).toBe(base);
    const reset = resetLiveData(played);
    expect(reset).toEqual(base);
    expect(isLineupLocked(reset)).toBe(false);
    expect(played.events).toHaveLength(1);
  });
});
