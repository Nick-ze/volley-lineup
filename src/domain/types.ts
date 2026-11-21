/**
 * Data model — docs/PLAN.md §6 (v2: SetLineup.liberoReplaces + SetLineup.events, schemaVersion 2;
 * v3: LineupPreset — saved team lineups and the team's starters, schemaVersion 3;
 * v4 / app 3.0: optional tags and timestamps on point events, schemaVersion 4 — PLAN §16).
 * These types are the single source of truth; never redefine them elsewhere.
 */

export type Position = 'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS';

export interface ManagerProfile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  number: number; // unique within team
  positions: Position[]; // first = primary
  active: boolean;
}

export interface Team {
  id: string;
  profileId: string;
  name: string;
  season?: string;
  createdAt: string;
}

export interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  home: boolean;
  sets: SetLineup[]; // length 1–5
}

export interface SetLineup {
  setNumber: 1 | 2 | 3 | 4 | 5;
  slots: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>; // court position -> playerId (starting six)
  liberoId: string | null;
  weServeFirst: boolean;
  /** v2: starters the libero replaces whenever they are in the back row (usually the middles). */
  liberoReplaces: string[];
  /** v2: what happened in the set, in order (live match mode). Empty = not played yet. */
  events: SetEvent[];
}

/** v2: which team won a rally. */
export type Side = 'us' | 'them';

/**
 * v4: what decided a rally (optional tag). 'kill' | 'ace' | 'block' | 'opponentError' belong to
 * points we won; 'ourError' | 'opponentKill' | 'opponentAce' to points they won.
 */
export type PointKind =
  'kill' | 'ace' | 'block' | 'opponentError' | 'ourError' | 'opponentKill' | 'opponentAce';

/** A rally. v4 adds the optional tag (`kind` + `playerId`) and the time it was recorded (`at`). */
export interface PointEvent {
  type: 'point';
  winner: Side;
  /** v4: optional tag; must belong to `winner` (see `src/domain/pointTags.ts`). */
  kind?: PointKind;
  /** v4: the player of our team the tag is about (kill / ace / block / ourError only). */
  playerId?: string;
  /** v4: ISO time the rally was recorded (used for the match duration). */
  at?: string;
}

export interface SubEvent {
  type: 'sub';
  outPlayerId: string;
  inPlayerId: string;
}

/** v2: one entry in a set's event log. The score, rotation and line-up are derived from it. */
export type SetEvent = PointEvent | SubEvent;

/** v3: 'starters' = the team's usual starting lineup (at most one per team); 'preset' = a named one. */
export type PresetKind = 'starters' | 'preset';

/** v3: a lineup saved for a team, applied to a match set on demand (never played itself). */
export interface LineupPreset {
  id: string;
  teamId: string;
  /** e.g. "5-1 strong serve"; empty for the starters (the UI shows a fixed label). */
  name: string;
  kind: PresetKind;
  slots: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>;
  liberoId: string | null;
  liberoReplaces: string[];
  createdAt: string;
}

export interface ExportFile {
  app: 'volley-lineup';
  schemaVersion: 4;
  exportedAt: string;
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  presets: LineupPreset[];
}

/* ---- Derived helper types (not part of the persisted shape) ---- */

/** Court position number 1–6. */
export type CourtPosition = keyof SetLineup['slots'];

/** Set number 1–5. */
export type SetNumber = SetLineup['setNumber'];

export const COURT_POSITIONS: readonly CourtPosition[] = [1, 2, 3, 4, 5, 6] as const;
export const SET_NUMBERS: readonly SetNumber[] = [1, 2, 3, 4, 5] as const;
export const ALL_POSITIONS: readonly Position[] = ['S', 'OH', 'MB', 'OPP', 'L', 'DS'] as const;
