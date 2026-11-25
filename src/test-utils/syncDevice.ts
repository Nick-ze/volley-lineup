/**
 * v10 sync engine tests: several "devices" in one Jest process. The app's stores are global, so
 * each device keeps its own copy of the persisted data, photos and runtime state and swaps them
 * in for `act` (devices take turns; never run two `act`s at once). Each device has its own
 * engine and backend (session) on the shared `FakeCloud`.
 */
import type { TeamData } from '@/domain/syncRecords';
import type { ManagerProfile, SyncData } from '@/domain/types';
import { createEngine, type EngineTiming, type SyncEngine } from '@/lib/sync/engine';
import {
  usePhotoStore,
  useAppStore,
  useSyncRuntime,
  type AppState,
  type SyncRuntimeState,
} from '@/store';
import { initialSyncStatus } from '@/store/syncRuntime';

import type { FakeBackend, FakeCloud } from './fakeBackend';

type Snapshot = TeamData &
  Pick<AppState, 'profiles' | 'currentProfileId' | 'sync' | 'hydrated' | 'tourMode'>;

export const PROFILE: ManagerProfile = {
  id: 'pr1',
  name: 'Coach',
  color: '#FF6B00',
  createdAt: '2026-01-01',
};

const emptyRuntime = (): SyncRuntimeState => ({
  status: initialSyncStatus(),
  session: null,
  holds: {},
  notices: [],
});

export class TestDevice {
  readonly backend: FakeBackend;
  readonly engine: SyncEngine;
  data: Snapshot;
  photos: Record<string, string> = {};
  runtime: SyncRuntimeState = emptyRuntime();

  constructor(
    readonly cloud: FakeCloud,
    readonly name: string,
    data: Partial<TeamData> = {},
    options: { skewMs?: number; timing?: EngineTiming } = {},
  ) {
    this.backend = cloud.device();
    const skew = options.skewMs ?? 0;
    this.engine = createEngine(this.backend, { now: () => cloud.clock.ms + skew }, options.timing);
    const sync: SyncData = { deviceId: name, account: null, teams: {} };
    this.data = {
      teams: [],
      players: [],
      seasons: [],
      opponents: [],
      matches: [],
      presets: [],
      ...data,
      profiles: [PROFILE],
      currentProfileId: PROFILE.id,
      sync,
      hydrated: true,
      tourMode: 'none',
    };
  }

  private load(): void {
    // Photos first: a change of the app store runs the photo prune against the photo store.
    usePhotoStore.setState({ photos: this.photos, hydrated: true });
    useAppStore.setState(this.data);
    useSyncRuntime.setState(this.runtime);
  }

  private save(): void {
    const s = useAppStore.getState();
    this.data = {
      teams: s.teams,
      players: s.players,
      seasons: s.seasons,
      opponents: s.opponents,
      matches: s.matches,
      presets: s.presets,
      profiles: s.profiles,
      currentProfileId: s.currentProfileId,
      sync: s.sync,
      hydrated: s.hydrated,
      tourMode: s.tourMode,
    };
    this.photos = usePhotoStore.getState().photos;
    this.runtime = useSyncRuntime.getState();
  }

  /** Runs `fn` with this device's state in the stores. */
  async act<T>(fn: (engine: SyncEngine) => T | Promise<T>): Promise<T> {
    this.load();
    try {
      return await fn(this.engine);
    } finally {
      this.save();
    }
  }

  /** Signs in (no code needed) and links the account to the device's profile. */
  async signIn(email: string): Promise<void> {
    const session = this.backend.signInAs(email);
    await this.act((engine) => {
      engine.setSession(session);
      useAppStore.getState().setSyncAccount({ ...session, profileId: PROFILE.id });
    });
  }

  /** One sync cycle. */
  cycle(): Promise<void> {
    return this.act((engine) => engine.runCycle());
  }

  /** Edits the device's data (as the UI would, through the store). */
  edit(fn: (s: AppState) => Partial<AppState>): Promise<void> {
    return this.act(() => {
      useAppStore.setState(fn);
    });
  }
}
