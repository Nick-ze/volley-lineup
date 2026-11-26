/**
 * v10: the sync engine (docs/V10_SYNC_DESIGN.md §3.6, §3.7): the cycle, its triggers and the
 * status. A cycle runs under a mutex (a trigger meanwhile asks for one more cycle):
 *   1. memberships: a team the account no longer belongs to is unlinked (local copy kept, with a
 *      notice); a changed role is stored; a demotion undoes the unsynced changes and the next
 *      pull replaces the team with the cloud's content (`resetToCloudMerge`, with a notice);
 *   2. live holds of the shared teams into the runtime store — before anything is pushed, so a
 *      match another device took over from this one is no longer saved from here (audit M1);
 *   3. per team: pull + merge (`teamSync.ts`), then push — not in a cycle that skipped rows of
 *      the team because their ids belong to another team on the device (error notice).
 * Offline / a paused server → status offline and a retry with a growing delay. Nothing here
 * throws to the UI or blocks a screen.
 *
 * Triggers: start (deferred until the first screen is idle), the app coming to the foreground
 * (and a last push when it goes to the background), a data change (3 s debounce, only while a
 * team is shared), every 60 s in the foreground (15 s while following a live match), commands
 * and "Sync now". Without a session nothing is sent; without a session and shared teams the
 * engine doesn't even subscribe to the store.
 */
import { AppState, type NativeEventSubscription } from 'react-native';

import { detectChanges } from '@/domain/syncChanges';
import { backoffMs } from '@/domain/syncStatus';
import type { SyncNotice } from '@/domain/types';
import { createId } from '@/lib/id';
import { useAppStore, useSyncRuntime, type AppState as StoreState } from '@/store';

import type { BackendSession, SessionEvent, SyncBackend } from './backend';
import { isoNow, systemClock, type Clock, type EngineCore } from './core';
import { toSyncError } from './errors';
import { setHolds } from './holdState';
import {
  appState,
  dropHolds,
  emitStatus,
  isApplying,
  linkedTeamIds,
  notify,
  setTeamMeta,
  sliceOf,
  teamName,
  unlinkTeams,
  updatePending,
  whenHydrated,
} from './storeOps';
import { forgetPhotos } from './photoSync';
import { dropGoneTeams, needsReset, noteAll, pullTeam, pushTeam } from './teamSync';

export interface EngineTiming {
  /** Delay of the first cycle after start (after the first screen is idle). */
  firstDelayMs: number;
  /** Delay after a data change before a cycle. */
  debounceMs: number;
  /** Foreground interval. */
  intervalMs: number;
  /** Interval while a live match is followed. */
  followMs: number;
}

export const DEFAULT_TIMING: EngineTiming = {
  firstDelayMs: 1500,
  debounceMs: 3000,
  intervalMs: 60_000,
  followMs: 15_000,
};

const DATA_KEYS = ['teams', 'players', 'seasons', 'opponents', 'matches', 'presets'] as const;

/** Runs `fn` once the JS thread is idle (soon, where there is no idle callback). */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 5000 });
  else setTimeout(fn, 0);
}

const dataChanged = (a: StoreState, b: StoreState) => DATA_KEYS.some((k) => a[k] !== b[k]);

export class SyncEngine implements EngineCore {
  readonly resetPending = new Set<string>();
  /** Teams this account was made manager of: the role is stored after their reset pull. */
  private readonly promoting = new Set<string>();
  readonly pendingPhotos = new Map<string, Set<string>>();
  readonly notified = new Set<string>();
  readonly yielded = new Set<string>();
  private current: BackendSession | null = null;
  private started = false;
  private needsRestore = false;
  private ownSignOut = false;
  private queue: Promise<unknown> = Promise.resolve();
  private cycling: Promise<void> | null = null;
  private again = false;
  private failures = 0;
  private followed: string | null = null;
  private appActive = true;
  private timers: Partial<Record<'retry' | 'debounce' | 'first', ReturnType<typeof setTimeout>>> =
    {};
  private interval: { timer: ReturnType<typeof setInterval>; ms: number } | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private appStateSub: NativeEventSubscription | null = null;
  private unsubscribeSession: (() => void) | null = null;

  constructor(
    readonly backend: SyncBackend,
    readonly clock: Clock = systemClock,
    private readonly timing: EngineTiming = DEFAULT_TIMING,
  ) {}

  /* ---------------------------------------------------------------- session */

  session(): BackendSession | null {
    return this.current;
  }

  setSession(session: BackendSession | null): void {
    const same = session?.userId === this.current?.userId && session?.email === this.current?.email;
    this.current = session;
    if (session) {
      this.needsRestore = false;
      this.setRestoring(false);
    }
    if (!same) useSyncRuntime.setState({ session });
    if (session && appState().sync.deviceId === null)
      useAppStore.getState().setDeviceId(createId());
    this.rewire();
  }

  /** Whether "no session" may still change once the stored session is read (runtime flag). */
  private setRestoring(on: boolean): void {
    if (useSyncRuntime.getState().restoring !== on) useSyncRuntime.setState({ restoring: on });
  }

  signingOut(on: boolean): void {
    this.ownSignOut = on;
  }

  private onSessionEvent(session: BackendSession | null, event: SessionEvent): void {
    if (event === 'signedOut' || !session) {
      const lost = this.current !== null && !this.ownSignOut;
      if (this.current) this.setSession(null);
      if (lost) emitStatus({ type: 'failed', code: 'signedOut', retryAt: null });
      return;
    }
    const wasSignedOut = this.current === null;
    this.setSession(session);
    if (wasSignedOut) this.kick();
  }

  /* ---------------------------------------------------------------- start / stop */

  start(): () => void {
    if (!this.started) {
      this.started = true;
      this.setRestoring(true);
      this.unsubscribeSession = this.backend.onSessionChange((s, e) => this.onSessionEvent(s, e));
      void this.boot();
    }
    return () => this.stop();
  }

  private async boot(): Promise<void> {
    await whenHydrated();
    if (!this.started) return;
    // Links an earlier version left behind for teams that were deleted with their profile
    // (audit C1): dropped before anything else, signed in or not.
    dropGoneTeams(this);
    const { account, teams } = appState().sync;
    const localOnly = !account && Object.keys(teams).length === 0;
    if (localOnly && !(await this.backend.hasStoredSession())) {
      this.setRestoring(false);
      emitStatus({ type: 'disabled' });
      return;
    }
    try {
      const session = await this.backend.getSession();
      if (session || !this.current) this.setSession(session);
      this.setRestoring(false);
    } catch (e) {
      if (toSyncError(e) === 'signedOut') {
        this.setRestoring(false);
        emitStatus({ type: 'failed', code: 'signedOut', retryAt: null });
      } else this.needsRestore = true; // offline: still restoring until a cycle reads it
    }
    this.rewire();
    updatePending(this.userId());
    // The first cycle hashes every shared team (~0.5–1.5 s on a phone): not before the first
    // screen is idle.
    whenIdle(() => {
      if (!this.started) return;
      this.timers.first = setTimeout(() => this.kick(), this.timing.firstDelayMs);
    });
  }

  stop(): void {
    this.started = false;
    this.setRestoring(false);
    for (const timer of Object.values(this.timers)) clearTimeout(timer);
    this.timers = {};
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.unwire();
  }

  /* ---------------------------------------------------------------- wiring */

  rewire(): void {
    if (!this.started) return;
    const linked = linkedTeamIds();
    const wantStore = this.current !== null || linked.length > 0;
    if (wantStore && !this.unsubscribeStore) {
      this.unsubscribeStore = useAppStore.subscribe((s, prev) => this.onStoreChange(s, prev));
    } else if (!wantStore && this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.current && !this.appStateSub) {
      this.appStateSub = AppState.addEventListener('change', (state) => this.onAppState(state));
    } else if (!this.current && this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
    const active =
      this.current !== null && this.appActive && linkedTeamIds(this.userId()).length > 0;
    const ms = this.followed ? this.timing.followMs : this.timing.intervalMs;
    if (this.interval && (!active || this.interval.ms !== ms)) {
      clearInterval(this.interval.timer);
      this.interval = null;
    }
    if (active && !this.interval) {
      this.interval = { timer: setInterval(() => this.onTick(), ms), ms };
    }
  }

  private unwire(): void {
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    this.appStateSub?.remove();
    this.appStateSub = null;
    if (this.interval) clearInterval(this.interval.timer);
    this.interval = null;
  }

  private onStoreChange(s: StoreState, prev: StoreState): void {
    if (prev.sync.account && !s.sync.account && this.current) void this.signOut();
    if (s.sync.teams !== prev.sync.teams) {
      // A team unlinked by the store itself (profile or team deleted, an import): forget what
      // this run remembered about it, or a later link of the same id would inherit it.
      const gone = Object.keys(prev.sync.teams).filter((id) => !(id in s.sync.teams));
      for (const teamId of gone) {
        forgetPhotos(this, teamId);
        this.resetPending.delete(teamId);
        this.promoting.delete(teamId);
      }
      if (gone.length > 0) dropHolds(gone);
      this.rewire();
    }
    if (isApplying() || !dataChanged(s, prev) || Object.keys(s.sync.teams).length === 0) return;
    clearTimeout(this.timers.debounce);
    this.timers.debounce = setTimeout(() => {
      noteAll(this);
      updatePending(this.userId());
      if (this.failures === 0) this.kick();
    }, this.timing.debounceMs);
  }

  private onAppState(state: string): void {
    const active = state === 'active';
    if (active !== this.appActive) {
      this.appActive = active;
      this.rewire();
    }
    // Foreground: catch up at once; background: a last push of what was just changed.
    if (state === 'active' || state === 'background') this.kick();
  }

  private onTick(): void {
    if (this.failures === 0) this.kick();
  }

  /* ---------------------------------------------------------------- scheduling */

  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Runs a cycle (or asks the running one to go again); resolves when cycles are done. */
  runCycle(): Promise<void> {
    if (this.cycling) {
      this.again = true;
      return this.cycling;
    }
    const loop = async () => {
      do {
        this.again = false;
        await this.exclusive(() => this.cycle());
      } while (this.again);
      this.cycling = null;
    };
    this.cycling = loop();
    return this.cycling;
  }

  kick(): void {
    void this.runCycle();
  }

  /** Resolves once no cycle runs (tests: before another device takes the stores). */
  async whenIdle(): Promise<void> {
    while (this.cycling) await this.cycling;
  }

  /** "Sync now": forget the back-off and sync at once. */
  async syncNow(): Promise<void> {
    this.failures = 0;
    clearTimeout(this.timers.retry);
    await this.runCycle();
  }

  followMatch(matchId: string | null): void {
    if (this.followed === matchId) return;
    this.followed = matchId;
    this.rewire();
    if (matchId && this.current && this.failures === 0) this.kick();
  }

  private userId(): string | null {
    return this.current?.userId ?? appState().sync.account?.userId ?? null;
  }

  /* ---------------------------------------------------------------- the cycle */

  private async cycle(): Promise<void> {
    // First, before any network call: changes get the time they were made, online or not.
    noteAll(this);
    try {
      if (this.needsRestore) {
        this.setSession(await this.backend.getSession());
        this.setRestoring(false);
      }
      const session = this.current;
      updatePending(this.userId());
      if (!session || linkedTeamIds(session.userId).length === 0) {
        emitStatus({ type: 'disabled' });
        return;
      }
      emitStatus({ type: 'start' });
      await this.refreshMemberships(session.userId);
      // Before the teams are synced: a take-over must be known before this device pushes.
      await this.refreshHolds(session.userId);
      const deviceId = appState().sync.deviceId ?? '';
      let firstError: ReturnType<typeof toSyncError> | null = null;
      for (const teamId of linkedTeamIds(session.userId)) {
        try {
          await this.syncTeam(teamId, deviceId);
        } catch (e) {
          const code = toSyncError(e);
          if (code === 'offline' || code === 'signedOut' || code === 'notSignedIn') throw e;
          firstError ??= code;
        }
      }
      this.failures = 0;
      emitStatus(
        firstError
          ? { type: 'failed', code: firstError, retryAt: null }
          : { type: 'done', at: isoNow(this.clock) },
      );
      updatePending(this.userId());
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    const code = toSyncError(e);
    if (code === 'offline') {
      this.failures += 1;
      const wait = backoffMs(this.failures);
      clearTimeout(this.timers.retry);
      if (this.started) this.timers.retry = setTimeout(() => this.kick(), wait);
      emitStatus({ type: 'offline', retryAt: isoNow({ now: () => this.clock.now() + wait }) });
    } else {
      this.setRestoring(false);
      emitStatus({ type: 'failed', code, retryAt: null });
    }
    updatePending(this.userId());
  }

  private async syncTeam(teamId: string, deviceId: string): Promise<void> {
    const reset = needsReset(this, teamId);
    const report = await pullTeam(this, teamId, reset);
    if (reset && report.present) this.resetPending.delete(teamId);
    if (this.promoting.has(teamId) && report.replaced) {
      // The copy and its bookkeeping are the cloud's now (`resetToCloudMerge` leaves nothing to
      // push): from here on this device's changes may be pushed.
      this.promoting.delete(teamId);
      const meta = appState().sync.teams[teamId];
      if (meta) setTeamMeta(teamId, { ...meta, role: 'manager' });
    }
    const skipped = report.foreign + report.invalid;
    if (skipped > 0)
      this.noticeOnce({ kind: 'skipped', teamId, teamName: teamName(teamId), count: skipped });
    if (report.foreign > 0 || !report.present) return;
    await pushTeam(this, teamId, deviceId);
  }

  private noticeOnce(notice: SyncNotice): void {
    const key = `${notice.kind}:${notice.teamId}`;
    if (this.notified.has(key)) return;
    this.notified.add(key);
    notify(notice);
  }

  private async refreshMemberships(userId: string): Promise<void> {
    const roles = new Map((await this.backend.memberships()).map((m) => [m.teamId, m.role]));
    for (const teamId of linkedTeamIds(userId)) {
      const meta = appState().sync.teams[teamId];
      const role = roles.get(teamId);
      if (!role) {
        const name = teamName(teamId);
        unlinkTeams([teamId]);
        forgetPhotos(this, teamId);
        this.resetPending.delete(teamId);
        this.promoting.delete(teamId);
        notify({ kind: 'removed', teamId, teamName: name });
      } else if (role !== meta.role) {
        if (meta.role === 'manager') {
          const undone = detectChanges(sliceOf(appState(), teamId), meta, '').changes.length;
          setTeamMeta(teamId, { ...meta, role, cursor: 0, edits: {} });
          this.resetPending.add(teamId);
          notify({ kind: 'demoted', teamId, teamName: teamName(teamId), undone });
        } else {
          // Promotion (audit H8): a view-only copy can differ from the cloud with no way to
          // heal, and as a manager's copy every difference would be pushed as an edit made
          // now (missing records as deletions). So the copy is first replaced by the cloud's,
          // like after a demotion; the stored role stays `player` (cursor 0: `needsReset`,
          // also after a restart) until that pull has worked (`syncTeam`).
          // Armed once per app run: a reset pull that can't bring the team's own row must not
          // turn every cycle into a pull from 0.
          if (!this.promoting.has(teamId)) {
            if (meta.cursor !== 0 || Object.keys(meta.edits).length > 0)
              setTeamMeta(teamId, { ...meta, cursor: 0, edits: {} });
            this.resetPending.add(teamId);
            this.promoting.add(teamId);
          }
        }
      } else this.promoting.delete(teamId);
    }
  }

  private async refreshHolds(userId: string): Promise<void> {
    const holds = await this.backend.listHolds(linkedTeamIds(userId));
    setHolds(this, Object.fromEntries(holds.map((h) => [h.matchId, h])));
  }

  /* ---------------------------------------------------------------- sign-out */

  /** Signs out on this device (local scope); never throws. Local data and links stay. */
  async signOut(): Promise<void> {
    this.ownSignOut = true;
    try {
      await this.backend.signOut();
    } catch {
      // The stored session is gone even when the server can't be reached.
    } finally {
      this.ownSignOut = false;
    }
    this.setSession(null);
    setHolds(this, {});
    emitStatus({ type: 'disabled' });
  }
}

export function createEngine(
  backend: SyncBackend,
  clock: Clock = systemClock,
  timing: EngineTiming = DEFAULT_TIMING,
): SyncEngine {
  return new SyncEngine(backend, clock, timing);
}
