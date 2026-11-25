/**
 * v10 sync test helpers (tests only, excluded from coverage): the golden data as team data, a
 * fake server that applies the server's last-write-wins rule like `push_records` /
 * `pull_changes` (docs/V10_SYNC_DESIGN.md §1.2), and a fake device that runs a sync cycle with
 * the pure domain functions only (pull + merge, detect + push), like the engine will.
 *
 * Domain-only: no store, no React (the domain tests import this file directly).
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TransferData } from '@/domain/exportFormat';
import { detectChanges, pushBatches, type LocalChange } from '@/domain/syncChanges';
import {
  applyPushResults,
  mergeRemote,
  nextCursor,
  resetToCloudMerge,
  type MergeOutput,
  type PushOutcome,
} from '@/domain/syncMerge';
import {
  foreignKeys,
  payloadHash,
  replaceTeamSlice,
  sliceToRecords,
  teamSlice,
  type RecordKind,
  type TeamData,
  type TeamSlice,
} from '@/domain/syncRecords';
import { parseRemoteRow, type RemoteRecord } from '@/domain/syncSchema';
import type { SyncBase, SyncedTeam, TeamRole } from '@/domain/types';

const GOLDEN_INPUT = path.join(__dirname, '../domain/__golden__/input.json');

/** The export golden data set (2 profiles, 2 teams t1 / t2, 3 matches, presets, photos). */
export function goldenTransfer(): TransferData {
  return JSON.parse(fs.readFileSync(GOLDEN_INPUT, 'utf8')) as TransferData;
}

/** The golden data's team collections (what the store's `AppData` has without profiles). */
export function goldenTeamData(): TeamData {
  const { teams, players, seasons, opponents, matches, presets } = goldenTransfer();
  return { teams, players, seasons, opponents, matches, presets };
}

/** An empty data set. */
export const emptyTeamData = (): TeamData => ({
  teams: [],
  players: [],
  seasons: [],
  opponents: [],
  matches: [],
  presets: [],
});

/** Sync state of a freshly linked team. */
export const linkedTeam = (overrides: Partial<SyncedTeam> = {}): SyncedTeam => ({
  userId: 'u1',
  role: 'manager',
  cursor: 0,
  base: {},
  edits: {},
  photos: [],
  ...overrides,
});

/** `base` as if the server had every record of the slice (versions 1, 2, … saved at `at`). */
export function serverBase(slice: TeamSlice, at: string): Record<string, SyncBase> {
  const base: Record<string, SyncBase> = {};
  let v = 0;
  for (const [key, payload] of sliceToRecords(slice)) {
    v += 1;
    base[key] = { v, h: payloadHash(payload), at };
  }
  return base;
}

/** The slice of `teamId`, which must exist. */
export function sliceOf(data: TeamData, teamId: string): TeamSlice {
  const slice = teamSlice(data, teamId);
  if (!slice) throw new Error(`no team ${teamId}`);
  return slice;
}

/**
 * The slice as a whole export file (its profile and a photo for every referenced id), for
 * `isConsistent`.
 */
export function sliceTransfer(slice: TeamSlice): TransferData {
  const photoIds = new Set(
    [slice.team, ...slice.players].flatMap((x) => (x.photoId === undefined ? [] : [x.photoId])),
  );
  return {
    profiles: [{ id: slice.team.profileId, name: 'Coach', color: 'red', createdAt: '2026-01-01' }],
    teams: [slice.team],
    players: slice.players,
    seasons: slice.seasons,
    opponents: slice.opponents,
    matches: slice.matches,
    presets: slice.presets,
    photos: [...photoIds].map((id) => ({ id, dataUri: 'data:image/png;base64,AAAA' })),
  };
}

/** A controllable clock in ms (shared by the server and the devices). */
export class Clock {
  constructor(public ms = Date.parse('2026-11-26T10:00:00.000Z')) {}
  iso(offsetMs = 0): string {
    return new Date(this.ms + offsetMs).toISOString();
  }
  tick(ms = 1000): void {
    this.ms += ms;
  }
}

interface ServerRow {
  kind: RecordKind;
  id: string;
  payload: unknown;
  deleted: boolean;
  at: number;
  updatedAt: number;
  version: number;
  deviceId: string;
}

/** The server: one team's `team_records`, with the LWW rule `(at, device_id)` and clamping. */
export class FakeServer {
  rows = new Map<string, ServerRow>();
  version = 0;
  /** Rows written but not committed yet (invisible to pulls), to test the cursor overlap. */
  uncommitted = new Set<string>();
  constructor(private clock: Clock) {}

  push(deviceId: string, changes: readonly LocalChange[]): PushOutcome[] {
    return changes.map((c) => {
      const key = `${c.kind}:${c.id}`;
      const at = Math.min(Date.parse(c.at), this.clock.ms + 60_000);
      const old = this.rows.get(key);
      const later = !old || at > old.at || (at === old.at && deviceId > old.deviceId);
      if (later) {
        this.version += 1;
        const row: ServerRow = {
          kind: c.kind,
          id: c.id,
          payload: c.payload === null ? null : JSON.parse(JSON.stringify(c.payload)),
          deleted: c.payload === null,
          at,
          updatedAt: this.clock.ms,
          version: this.version,
          deviceId,
        };
        this.rows.set(key, row);
        return this.outcome(row, true);
      }
      return this.outcome(old, false);
    });
  }

  private outcome(row: ServerRow, applied: boolean): PushOutcome {
    return {
      kind: row.kind,
      id: row.id,
      applied,
      version: row.version,
      at: new Date(row.at).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      deleted: row.deleted,
      ...(applied ? {} : { payload: row.payload as PushOutcome['payload'] }),
    };
  }

  /** `pull_changes` as JSON rows (Postgres-like timestamps with microseconds). */
  pull(after: number, limit = 500): { server_now: string; rows: unknown[] } {
    const pg = (ms: number) => new Date(ms).toISOString().replace('Z', '123+00:00');
    const rows = [...this.rows.values()]
      .filter((r) => r.version > after && !this.uncommitted.has(`${r.kind}:${r.id}`))
      .sort((a, b) => a.version - b.version)
      .slice(0, limit)
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        payload: r.payload,
        deleted: r.deleted,
        at: pg(r.at),
        updated_at: pg(r.updatedAt),
        version: r.version,
        device_id: r.deviceId,
      }));
    return { server_now: pg(this.clock.ms), rows };
  }
}

/** A device with its own data and sync state for team `teamId`, syncing through `server`. */
export class FakeDevice {
  skipped: MergeOutput['skipped'] = [];
  issues: MergeOutput['issues'] = [];
  constructor(
    public readonly id: string,
    private server: FakeServer,
    private clock: Clock,
    public readonly teamId: string,
    public data: TeamData,
    public sync: SyncedTeam,
    public profileId = 'pr1',
    /** This device's clock skew in ms. */
    public skewMs = 0,
  ) {}

  get slice(): TeamSlice | undefined {
    return teamSlice(this.data, this.teamId);
  }

  get role(): TeamRole {
    return this.sync.role;
  }

  edit(fn: (data: TeamData) => TeamData): void {
    this.data = fn(this.data);
  }

  /** foreignId skips of the last pull: the engine doesn't push in such a cycle. */
  foreignSkips = 0;

  private apply(rows: readonly RemoteRecord[], reset = false): number {
    const out = (reset ? resetToCloudMerge : mergeRemote)({
      teamId: this.teamId,
      slice: this.slice,
      team: this.sync,
      rows,
      local: { profileId: this.profileId },
      foreignIds: foreignKeys(this.data, this.teamId),
    });
    this.skipped.push(...out.skipped);
    this.issues = out.issues;
    this.sync = out.team;
    this.data = replaceTeamSlice(this.data, this.teamId, out.slice);
    return out.skipped.filter((s) => s.reason === 'foreignId').length;
  }

  /**
   * Pulls every page since the cursor and merges it in one go (`reset`: `resetToCloudMerge`,
   * from version 0).
   */
  pull(reset = false, pageSize = 500): void {
    const rows: RemoteRecord[] = [];
    let cursor = this.sync.cursor;
    let serverNow = '';
    for (;;) {
      const page = this.server.pull(cursor, pageSize);
      serverNow = page.server_now;
      const parsed = page.rows.map(parseRemoteRow).filter((r): r is RemoteRecord => r !== null);
      rows.push(...parsed);
      if (page.rows.length < pageSize) break;
      cursor = Math.max(...page.rows.map((r) => (r as { version: number }).version));
    }
    this.foreignSkips = this.apply(rows, reset);
    // Without the team (its row hasn't arrived) the rows must be read again.
    if (!this.slice) return;
    this.sync = { ...this.sync, cursor: nextCursor(this.sync.cursor, rows, serverNow) };
  }

  /** Detects and pushes local changes (managers only), merging rows the server kept. */
  push(): LocalChange[] {
    const detected = detectChanges(this.slice, this.sync, this.clock.iso(this.skewMs));
    this.sync = { ...this.sync, edits: detected.edits };
    if (this.sync.role !== 'manager') return [];
    for (const batch of pushBatches(detected.changes)) {
      const results = this.server.push(this.id, batch);
      const { team, stale } = applyPushResults(this.sync, batch, results);
      this.sync = team;
      if (stale.length > 0) this.apply(stale);
    }
    return detected.changes;
  }

  /** Notes local changes (as the engine does 1.5 s after a change) without pushing. */
  detect(): void {
    this.sync = {
      ...this.sync,
      edits: detectChanges(this.slice, this.sync, this.clock.iso(this.skewMs)).edits,
    };
  }

  /**
   * One sync cycle: note local changes first (an unnoted change would lose against any pulled
   * row), pull, then push.
   */
  cycle(): void {
    this.detect();
    this.pull();
    if (this.foreignSkips === 0) this.push();
  }
}
