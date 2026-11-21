import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

/**
 * Whether confidential player descriptions are visible (PLAN §25.3). App-wide and in memory
 * only — deliberately NOT persisted, so a restart always starts locked. Once unlocked, every
 * description stays visible until `lock()`: the Lock button, or the app leaving the
 * foreground (see `handleAppStateChange`).
 *
 * `includeInExport` is the Settings → Export "Include descriptions" choice; it only exists
 * while unlocked, so locking turns it off again (DECISIONS #150).
 */
export interface DescriptionLockState {
  unlocked: boolean;
  includeInExport: boolean;
  unlock: () => void;
  lock: () => void;
  setIncludeInExport: (value: boolean) => void;
}

export const useDescriptionLock = create<DescriptionLockState>()((set) => ({
  unlocked: false,
  includeInExport: false,
  unlock: () => set({ unlocked: true }),
  lock: () => set({ unlocked: false, includeInExport: false }),
  setIncludeInExport: (value) => set((s) => ({ includeInExport: s.unlocked && value })),
}));

/** True while the system's biometric / PIN prompt is open (on iOS it makes the app inactive). */
let prompting = false;

/** Marks the system unlock prompt as open / closed. */
export function setPrompting(value: boolean): void {
  prompting = value;
}

/**
 * Locks when the app goes to the background (RN), when the tab is hidden (react-native-web
 * reports `visibilitychange` → hidden as `background`), or when iOS makes it inactive (app
 * switcher), except while our own unlock prompt is what made it inactive.
 */
export function handleAppStateChange(next: AppStateStatus): void {
  if (next === 'background' || (next === 'inactive' && !prompting)) {
    useDescriptionLock.getState().lock();
  }
}

// One app-wide listener for the lifetime of the app (the module is loaded once).
AppState.addEventListener('change', handleAppStateChange);
