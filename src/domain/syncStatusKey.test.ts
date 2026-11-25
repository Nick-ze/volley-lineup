import { syncStatusKey } from './syncStatusKey';

describe('syncStatusKey', () => {
  it('keeps every phase but off as it is', () => {
    for (const phase of ['synced', 'syncing', 'offline', 'error'] as const) {
      expect(syncStatusKey(phase, true, 0)).toBe(phase);
      expect(syncStatusKey(phase, false, 2)).toBe(phase);
    }
  });

  it('off: "Not signed in" only without a session', () => {
    expect(syncStatusKey('off', false, 0)).toBe('off');
    expect(syncStatusKey('off', false, 3)).toBe('off');
  });

  it('off while signed in: no shared teams, or the first cycle is about to run', () => {
    expect(syncStatusKey('off', true, 0)).toBe('noTeams');
    expect(syncStatusKey('off', true, 1)).toBe('syncing');
  });
});
