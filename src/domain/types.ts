/**
 * Data model — docs/PLAN.md §6 (v2: SetLineup.liberoReplaces + SetLineup.events, schemaVersion 2;
 * v3: LineupPreset — saved team lineups and the team's starters, schemaVersion 3;
 * v4 / app 3.0: optional tags and timestamps on point events, schemaVersion 4 — PLAN §16;
 * v5 / app 4.0: roles on court + libero on/off per lineup, schemaVersion 5 — PLAN §20;
 * v6 / app 5.0: roles belong to the court spots (a formation), not players, schemaVersion 6 —
 * PLAN §23; see docs/VOLLEYBALL_RULES.md;
 * v7 / app 6.0: photos for profiles and players, confidential player descriptions, an optional
 * error type on "our error" tags, schemaVersion 7 — PLAN §26;
 * v8 / app 7.0: seasons / tournaments with their opponent teams; every match belongs to one,
 * schemaVersion 8 — PLAN §29;
 * v9.1: an optional team captain (`Team.captainId`), schemaVersion 10;
 * v10 / app 10.0: device-only sync bookkeeping (store v13 `sync`) — the export is unchanged, see
 * docs/V10_SYNC_DESIGN.md §3).
 * These types are the single source of truth; never redefine them elsewhere.
 */

export type Position = 'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS';

export interface ManagerProfile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  /** v7: the profile picture (`Photo.id`); none = the coloured avatar. */
  photoId?: string;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  number: number; // unique within team
  positions: Position[]; // first = primary
  active: boolean;
  /** v7: the player's picture (`Photo.id`); none = the jersey number. */
  photoId?: string;
  /**
   * v7: confidential free-text notes. Hidden in the UI until unlocked; exported only when the
   * user ticks "Include descriptions". Never empty when present (trimmed, ≤ 1000 characters).
   */
  description?: string;
}

/** v7: a small picture (≤ 256 px JPEG) stored on the device, referenced by `photoId`. */
export interface Photo {
  id: string;
  /** `data:image/jpeg;base64,…` (also png / webp). */
  dataUri: string;
}

export interface Team {
  id: string;
  profileId: string;
  name: string;
  season?: string;
  createdAt: string;
  /** v9 (app 8.0): the team's picture (`Photo.id`); none = the team's initial. */
  photoId?: string;
  /** v10 (app 9.1): the team captain, a player of this team (`Player.id`); none by default. */
  captainId?: string;
}

/** v8: a season (league) or a tournament of a team. Every match belongs to one. */
export type SeasonKind = 'season' | 'tournament';

export interface Season {
  id: string;
  teamId: string;
  /** e.g. "2026/27" or "Beach Cup"; unique within the team (ignoring case). */
  name: string;
  kind: SeasonKind;
  /** Optional ISO dates (YYYY-MM-DD) and place. */
  startDate?: string;
  endDate?: string;
  location?: string;
  createdAt: string;
}

/** v8: a team we play against in a season (unique name within the season, ignoring case). */
export interface Opponent {
  id: string;
  seasonId: string;
  name: string;
  createdAt: string;
}

export interface Match {
  id: string;
  teamId: string;
  /** v8: the season / tournament the match belongs to. */
  seasonId: string;
  /** v8: the opposing team (an `Opponent` of the same season). */
  opponentId: string;
  /** The opponent's name as shown for the match (kept equal to the opponent's name on rename). */
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
  /**
   * v6: the roles of the six court spots (5-1 or 6-2, fixed by the volleyball rules); whoever
   * stands on a spot plays its role. Rotates together with the players.
   */
  formation: Formation;
  /** v5: false = the libero stays out (no libero swaps), even if one is chosen. */
  liberoActive: boolean;
}

/** v6: team system. 5-1 = one setter + opposite; 6-2 = two setters opposite each other. */
export type FormationSystem = '5-1' | '6-2';

/**
 * v6: the order of roles around the court after the setter: 'outside' = S · OH · MB · (OPP|S) ·
 * OH · MB (the textbook order), 'middle' = S · MB · OH · (OPP|S) · MB · OH.
 */
export type FormationOrder = 'outside' | 'middle';

/** v6: a formation — system, order, and the court position of the (first) setter. */
export interface Formation {
  system: FormationSystem;
  order: FormationOrder;
  setterAt: 1 | 2 | 3 | 4 | 5 | 6;
}

/** Derived (not stored): player id → the role they play (e.g. in a replay, subs inherit). */
export type PlayerRoles = Record<string, Position>;

/** v2: which team won a rally. */
export type Side = 'us' | 'them';

/**
 * v4: what decided a rally (optional tag). 'kill' | 'ace' | 'block' | 'opponentError' belong to
 * points we won; 'ourError' | 'opponentKill' | 'opponentAce' to points they won.
 */
export type PointKind =
  'kill' | 'ace' | 'block' | 'opponentError' | 'ourError' | 'opponentKill' | 'opponentAce';

/**
 * v7: what kind of error an "our error" tag was (optional; none = unspecified). Net / foul
 * covers the referee's faults that aren't a skill error: net touch, centre line, rotation /
 * positional fault, ball handling (double / catch), 4 hits. See docs/VOLLEYBALL_RULES.md §7.
 */
export type ErrorType = 'serve' | 'reception' | 'attack' | 'block' | 'set' | 'netFault' | 'other';

/** A rally. v4 adds the optional tag (`kind` + `playerId`) and the time it was recorded (`at`). */
export interface PointEvent {
  type: 'point';
  winner: Side;
  /** v4: optional tag; must belong to `winner` (see `src/domain/pointTags.ts`). */
  kind?: PointKind;
  /** v4: the player of our team the tag is about (kill / ace / block / ourError only). */
  playerId?: string;
  /** v7: the kind of error, only with `kind: 'ourError'` (optional). */
  errorType?: ErrorType;
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
  /** v6: as in `SetLineup`. */
  formation: Formation;
  /** v5: as in `SetLineup`. */
  liberoActive: boolean;
  createdAt: string;
}

/* ---- v12.0 hosted tournaments (store v14, export v11; never synced) ---- */

/** v12: how many sets a match of a hosted tournament has. */
export type SetsPerMatch = 1 | 2 | 3 | 4 | 5;

/**
 * v12: how a match of a hosted tournament ends: `bestOf` (1, 3 or 5 sets) when a team has won
 * more than half of the sets; `allSets` when every set was played (a draw is possible).
 */
export type MatchEnd = 'bestOf' | 'allSets';

/**
 * v12: a tournament the coach hosts: a neutral scoreboard for all its teams (names and results,
 * no rosters, lineups or live scoring). It belongs to a profile, not to a team.
 */
export interface HostedTournament {
  id: string;
  profileId: string;
  /** Unique within the profile, ignoring case. */
  name: string;
  /** ISO `YYYY-MM-DD`. */
  date?: string;
  location?: string;
  setsPerMatch: SetsPerMatch;
  /** Always `allSets` when `setsPerMatch` is 2 or 4. */
  matchEnd: MatchEnd;
  createdAt: string;
}

/** v12: a team of a hosted tournament (only a name). */
export interface HostedTeam {
  id: string;
  tournamentId: string;
  name: string;
  /** The order added; the plan is built from it. */
  order: number;
}

/** v12: one set of a hosted match: the ball points of the pair's two teams. */
export interface HostedSetScore {
  a: number;
  b: number;
}

/**
 * v12: a result of a hosted tournament. At most one per pair of teams; `teamAId` is the pair's
 * team with the lower `order`. Only this is stored: plan, outcome and table are derived.
 */
export interface HostedResult {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  /** 1 … `setsPerMatch` sets, in the order played. */
  sets: HostedSetScore[];
}

export interface ExportFile {
  app: 'volley-lineup';
  schemaVersion: 11;
  exportedAt: string;
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  presets: LineupPreset[];
  /** v7: the pictures referenced by profiles and players (v9: and teams). */
  photos: Photo[];
  /** v8: seasons / tournaments and their opponent teams. */
  seasons: Season[];
  opponents: Opponent[];
  /** v11 (app 12.0): hosted tournaments with their teams and results. */
  hostedTournaments: HostedTournament[];
  hostedTeams: HostedTeam[];
  hostedResults: HostedResult[];
}

/* ---- v9.0 tutorial (device settings in the app store; not exported) ---- */

/** v9.0 (store v11): which tour the user chose: tips on every screen, the quick path, or none. */
export type TourMode = 'full' | 'quick' | 'none';

/**
 * v9.0: a screen (or tab) with its own tour tips. The quick tour covers profiles → … → builder;
 * the order and the lists live in `tour.ts`.
 */
export type TourPage =
  | 'profiles'
  | 'teams'
  | 'roster'
  | 'playerForm'
  | 'matches'
  | 'seasonForm'
  | 'seasonMatches'
  | 'matchForm'
  | 'builder'
  | 'profile'
  | 'settings'
  | 'presets'
  | 'starters'
  | 'teamStats'
  | 'playerDetail'
  | 'presetEditor'
  | 'startersEditor'
  | 'seasonOpponents'
  | 'seasonStats'
  | 'rotation'
  | 'matchStarters'
  | 'live'
  | 'performance'
  | 'matchStats'
  // v10.0: accounts and shared teams
  | 'account'
  | 'signIn'
  | 'cloudTeams'
  | 'members'
  | 'join'
  // v12.0: hosted tournaments
  | 'tournaments'
  | 'tournamentForm'
  | 'tournamentTable'
  | 'tournamentMatches'
  | 'tournamentTeams'
  | 'tournamentTeam'
  | 'tournamentResult';

/* ---- v10.0 accounts and cloud sync (store v13 `sync`; device-only, never exported) ---- */

/** v10: a member's role in a shared team. Managers edit everything; players only view. */
export type TeamRole = 'manager' | 'player';

/** v10: the account signed in on this device, linked to one local profile. */
export interface SyncAccount {
  userId: string;
  email: string;
  /** The local profile the account belongs to; shared teams live under it. */
  profileId: string;
}

/**
 * v10: what this device last saw on the server for one record: server version, payload hash
 * (`''` when deleted), the (clamped) save time, and whether it is a tombstone.
 */
export interface SyncBase {
  v: number;
  h: string;
  at: string;
  del?: true;
}

/** v10: a local change waiting to be pushed: the save time and payload hash (`''` = deletion). */
export interface SyncEdit {
  at: string;
  h: string;
}

/** v10: sync bookkeeping for one shared team on this device. Keys are `${kind}:${id}`. */
export interface SyncedTeam {
  /** The account this team syncs through on this device. */
  userId: string;
  /** Cached role (refreshed every sync), so view-only also works offline. */
  role: TeamRole;
  /**
   * Highest gap-free server version pulled. 0: nothing yet — on a view-only copy with a `base`
   * also "replace it by the cloud's on the next pull". -1 (`REPULL_CURSOR`): pull everything
   * again and merge it the normal way (after an app update, v10 audit L6).
   */
  cursor: number;
  base: Record<string, SyncBase>;
  edits: Record<string, SyncEdit>;
  /** Photo ids known to exist in the team's cloud folder. */
  photos: string[];
}

/** v10 (store v13): device-only sync state, persisted with the data so both are written at once. */
export interface SyncData {
  /** Random id of this installation (set on first sync start). */
  deviceId: string | null;
  account: SyncAccount | null;
  /** Shared (linked) teams by team id. A team missing here is a local-only team. */
  teams: Record<string, SyncedTeam>;
}

/** v10: the sync engine's state for the status badge (runtime only, not persisted). */
export type SyncPhase = 'off' | 'synced' | 'syncing' | 'offline' | 'error';

/** v10: why a sync command or cycle failed (mapped to i18n text by the UI). */
export type SyncErrorCode =
  | 'offline'
  | 'forbidden'
  | 'lastManager'
  | 'lastMember'
  | 'inviteInvalid'
  | 'notSignedIn'
  | 'signedOut'
  | 'invalidCode'
  | 'rateLimited'
  | 'tooMany'
  /** v10 audit M13: the auth server couldn't send the code email (e.g. the mail quota is used up). */
  | 'mailFailed'
  /** v10 audit M13: the address can't sign in (invalid, not allowed, or sign-ups are off). */
  | 'emailRejected'
  | 'unknown';

export interface SyncStatus {
  phase: SyncPhase;
  /** Local changes not yet on the server (shared teams this device may edit). */
  pending: number;
  lastSyncedAt: string | null;
  error: SyncErrorCode | null;
  /** When the next automatic try is due after going offline / an error. */
  retryAt: string | null;
}

/** v10: something the user should know after a sync (shown once as a banner). */
export type SyncNotice =
  | { kind: 'removed'; teamId: string; teamName: string }
  /** Not sent: the server can't tell a deletion from a removal, so `removed` covers both (L24). */
  | { kind: 'deleted'; teamId: string; teamName: string }
  | { kind: 'demoted'; teamId: string; teamName: string; undone: number }
  | { kind: 'skipped'; teamId: string; teamName: string; count: number }
  /** Another device took over scoring a match: `undone` unsynced changes here gave way. */
  | { kind: 'takenOver'; teamId: string; teamName: string; holder: string; undone: number }
  /**
   * A linked team can't be shown yet: its own record hasn't arrived or can't be read by this app
   * version (v10 audit M6). The team isn't on the device, so there is no name (`teamName` '').
   */
  | { kind: 'waiting'; teamId: string; teamName: string }
  /**
   * `count` records of the team can't be saved to the cloud as they are (v10 audit M3, M4):
   * this app would refuse them itself when pulled (`tooLong`: a name over 200 or another text
   * over 1000 characters; `invalid`: anything else it can't read back), or the server refused
   * them (`refused`). `label` names the first one ('' when it has no name).
   */
  | {
      kind: 'unsent';
      teamId: string;
      teamName: string;
      count: number;
      label: string;
      reason: 'tooLong' | 'invalid' | 'refused';
    };

/** v10: an advisory lease on a match while one device scores it live (`match_holds`). */
export interface MatchHold {
  matchId: string;
  teamId: string;
  deviceId: string;
  userId: string;
  holderName: string;
  /** ISO time the lease ends unless refreshed. */
  heldUntil: string;
}

/* ---- Derived helper types (not part of the persisted shape) ---- */

/** Court position number 1–6. */
export type CourtPosition = keyof SetLineup['slots'];

/** Set number 1–5. */
export type SetNumber = SetLineup['setNumber'];

export const COURT_POSITIONS: readonly CourtPosition[] = [1, 2, 3, 4, 5, 6] as const;
export const SET_NUMBERS: readonly SetNumber[] = [1, 2, 3, 4, 5] as const;
/** v12: the choices for a hosted tournament's sets per match. */
export const SETS_PER_MATCH: readonly SetsPerMatch[] = [1, 2, 3, 4, 5] as const;
export const MATCH_ENDS: readonly MatchEnd[] = ['bestOf', 'allSets'] as const;
/** v7: error types in display order. */
export const ERROR_TYPES: readonly ErrorType[] = [
  'serve',
  'reception',
  'attack',
  'block',
  'set',
  'netFault',
  'other',
] as const;

/** Every point tag kind (`PointKind`); the tag rows order them in `pointTags.ts`. */
export const POINT_KINDS = [
  'kill',
  'ace',
  'block',
  'opponentError',
  'ourError',
  'opponentKill',
  'opponentAce',
] as const satisfies readonly PointKind[];

export const ALL_POSITIONS: readonly Position[] = ['S', 'OH', 'MB', 'OPP', 'L', 'DS'] as const;
