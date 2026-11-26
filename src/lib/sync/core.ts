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
  /**
   * Photo ids per team the cloud answered "not found" for in this app run (v10 audit M18): once
   * this device has such a picture (again), it uploads it with the record's next change.
   */
  readonly lostPhotos: Map<string, Set<string>>;
  /** Teams whose cloud folder was compared with the stored list in this app run (`checkFolder`). */
  readonly checkedFolders: Set<string>;
  /** Notice keys already shown in this run (each shown once). */
  readonly notified: Set<string>;
  /** Matches this device was scoring that another device holds now (`holdState.ts`). */
  readonly yielded: Set<string>;
  /**
   * Linked teams that aren't on the device because their own record hasn't arrived or can't be
   * read (v10 audit M6), with where their last complete pull got to: until a newer `team` row
   * shows up, a cycle only asks for what is new instead of pulling everything again. Kept for
   * the app run only (the first cycle after a restart pulls completely once).
   */
  readonly awaited: Map<string, AwaitedTeam>;
  /**
   * Per team, what the server refused to store as it is (`groupSignature`s, v10 audit M4): not
   * sent again in this app run until something in it has changed.
   */
  readonly refused: Map<string, Set<string>>;
  /**
   * Per team, what its notice about records that can't be pushed last said (v10 audit M3, M4):
   * it is shown again only when that has changed.
   */
  readonly unsent: Map<string, string>;
  /**
   * The size of a push batch. Lowered when a push timed out on a slow connection (v10 audit
   * M5); it stays lowered for the app run.
   */
  readonly pushLimit: { count: number; bytes: number };
}

export interface AwaitedTeam {
  /** The pull position of the checks (the cursor rule of a normal pull, never stored). */
  cursor: number;
  /** The version of the `team` row the last complete pull saw (-1: none). */
  teamRow: number;
}

export const isoNow = (clock: Clock): string => new Date(clock.now()).toISOString();
