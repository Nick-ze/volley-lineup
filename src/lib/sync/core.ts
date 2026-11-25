/**
 * v10: what the sync engine's parts share (the engine implements it; the team sync and the
 * commands use it). Internal to `src/lib/sync`.
 */
import type { BackendSession, SyncBackend } from './backend';

/** The engine's time source (ms since the epoch); tests pass a controllable one. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface EngineCore {
  readonly backend: SyncBackend;
  readonly clock: Clock;
  /** The signed-in session (null: signed out). */
  session(): BackendSession | null;
  setSession(session: BackendSession | null): void;
  /** Runs `fn` while no sync cycle or other team command runs (one at a time). */
  exclusive<T>(fn: () => Promise<T>): Promise<T>;
  /** Asks for a sync cycle soon (never waits for it). */
  kick(): void;
  /** Re-evaluates the store subscription and timers (after a team was linked or unlinked). */
  rewire(): void;
  /** Called before the engine signs out itself (so the session's end isn't an error). */
  signingOut(on: boolean): void;
  /** Teams to reset to the cloud's content on their next pull (after a demotion). */
  readonly resetPending: Set<string>;
  /** Photo ids per team that couldn't be downloaded yet (retried every cycle). */
  readonly pendingPhotos: Map<string, Set<string>>;
  /** Notice keys already shown in this run (each shown once). */
  readonly notified: Set<string>;
}

export const isoNow = (clock: Clock): string => new Date(clock.now()).toISOString();
