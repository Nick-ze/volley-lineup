import type {
  HostedData,
  HostedPlayerValue,
  LiveState,
  TournamentFormValue,
} from '@/domain/hostedTournament';
import type {
  HostedPlayer,
  HostedPlayerLabel,
  HostedResult,
  HostedSetScore,
  HostedTeam,
  HostedTournament,
  LineupPreset,
  ManagerProfile,
  Match,
  Opponent,
  Player,
  Season,
  SetLineup,
  SyncAccount,
  SyncData,
  Team,
  TourMode,
  TourPage,
} from '@/domain/types';
import type { PresetLineup } from '@/domain/presets';
import type { ThemeMode } from '@/theme/theme';

/** The persisted data. Bump STORE_VERSION and add a migration when this shape changes. */
export interface AppData extends HostedData {
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  /** v3: saved lineups and the team's starters. */
  presets: LineupPreset[];
  /** v9 (app 7.0): seasons / tournaments and their opponent teams. */
  seasons: Season[];
  opponents: Opponent[];
  // v14 (app 12.0), from `HostedData`: `hostedTournaments`, `hostedTeams`, `hostedResults` —
  // tournaments the coach hosts. They belong to a profile and are never synced.
}

/**
 * The team collections (everything of `AppData` except the hosted tournaments): what an import
 * or the sync engine hands to `replaceAll`.
 */
export type TeamCollections = Omit<AppData, keyof HostedData>;

/** UI language (v2). English is the default; strings live in src/i18n. */
export type Language = 'en' | 'de';

/** What the player chips show big (v3.1): the jersey number (default) or the name. */
export type ChipLabel = 'number' | 'name';

/** v8 (store v10): the app's colour theme. 'system' follows the device's light / dark mode. */
export type { ThemeMode };

export interface AppState extends AppData {
  currentProfileId: string | null;
  language: Language;
  /** v3.1 (store v5): a device setting like the language — not exported. */
  chipLabel: ChipLabel;
  /** v8 (store v10): device settings like the language — kept on "Delete all data", not exported. */
  themeMode: ThemeMode;
  /** v8 (store v10): all text in the dyslexia-friendly font (OpenDyslexic). */
  dyslexiaFont: boolean;
  /**
   * v9.0 (store v11): the chosen tour (null = not chosen yet, so the app asks) and the pages whose
   * tips were shown or offered. Device settings like the theme: kept on "Delete all data", not
   * exported.
   */
  tourMode: TourMode | null;
  tourSeen: TourPage[];
  /**
   * v10 (store v13): device-only sync bookkeeping (account link, shared teams, what the server
   * has). Persisted with the data so records and their sync state are written together; never
   * exported. See docs/V10_SYNC_DESIGN.md §3.2.
   */
  sync: SyncData;
  /** True once persisted state has been loaded from storage. Not persisted. */
  hydrated: boolean;
}

export type NewProfile = Pick<ManagerProfile, 'name' | 'color'>;
export type NewTeam = Pick<Team, 'profileId' | 'name' | 'season'>;
export type NewPlayer = Omit<Player, 'id'>;
export type NewMatch = Pick<
  Match,
  'teamId' | 'seasonId' | 'opponentId' | 'opponent' | 'date' | 'home'
> & {
  sets?: SetLineup[];
};
export type NewSeason = Pick<Season, 'teamId' | 'name' | 'kind'> &
  Partial<Pick<Season, 'startDate' | 'endDate' | 'location'>>;

/** What a tournament is created or updated with; `plan` may be left out (new: the app makes the
 * plan; update: it stays as it is). */
export type HostedTournamentValue = Omit<TournamentFormValue, 'plan'> &
  Partial<Pick<TournamentFormValue, 'plan'>>;
export type NewHostedTournament = Pick<HostedTournament, 'profileId'> & HostedTournamentValue;

/** v16: a hosted match — an added match by its id, or a round robin's pair of teams. */
export type HostedMatchRef =
  { matchId: string } | { tournamentId: string; teamAId: string; teamBId: string };

export type NewPreset = Pick<LineupPreset, 'teamId' | 'name'> & Partial<PresetLineup>;

export interface AppActions {
  // profiles
  addProfile(input: NewProfile): ManagerProfile;
  updateProfile(id: string, patch: Partial<Omit<ManagerProfile, 'id' | 'createdAt'>>): void;
  deleteProfile(id: string): void;
  selectProfile(id: string | null): void;
  // teams
  addTeam(input: NewTeam): Team;
  updateTeam(id: string, patch: Partial<Omit<Team, 'id' | 'profileId' | 'createdAt'>>): void;
  deleteTeam(id: string): void;
  // players
  addPlayer(input: NewPlayer): Player;
  updatePlayer(id: string, patch: Partial<Omit<Player, 'id' | 'teamId'>>): void;
  /** Deletes the player everywhere (v12: a captain leaves the team without one). */
  deletePlayer(id: string): void;
  /**
   * v12 (app 9.1): the player form's "Team captain" switch: on makes the player the team's captain
   * (replacing the previous one); off clears it when this player was the captain.
   */
  setCaptain(teamId: string, playerId: string, on: boolean): void;
  // matches
  addMatch(input: NewMatch): Match;
  updateMatch(id: string, patch: Partial<Omit<Match, 'id' | 'teamId'>>): void;
  deleteMatch(id: string): void;
  // seasons / opponents (v9)
  addSeason(input: NewSeason): Season;
  /** Replaces name, kind, dates and place (omitted optional fields are removed). */
  updateSeason(id: string, value: Omit<NewSeason, 'teamId'>): void;
  /** Deletes the season with its opponents and matches. */
  deleteSeason(id: string): void;
  addOpponent(seasonId: string, name: string): Opponent;
  /** Renames the opponent and every match against them. */
  renameOpponent(id: string, name: string): void;
  /** Deletes an opponent without matches (does nothing when they have matches). */
  deleteOpponent(id: string): void;
  /** Insert or replace the lineup for `set.setNumber` in a match. */
  setLineup(matchId: string, set: SetLineup): void;
  // presets (v3)
  /** Adds a named preset (kind 'preset'); the lineup defaults to empty. */
  addPreset(input: NewPreset): LineupPreset;
  updatePreset(id: string, patch: Partial<Pick<LineupPreset, 'name'> & PresetLineup>): void;
  deletePreset(id: string): void;
  /** Creates or replaces the lineup of the team's single 'starters' preset. */
  setStarters(teamId: string, lineup: PresetLineup): LineupPreset;
  // hosted tournaments (v14, app 12.0)
  addHostedTournament(input: NewHostedTournament): HostedTournament;
  /** Replaces name, date, place and settings (omitted optional fields are removed). */
  updateHostedTournament(id: string, value: HostedTournamentValue): void;
  /** Deletes the tournament with its teams and results. */
  deleteHostedTournament(id: string): void;
  /** Adds a team at the end of the tournament's order. */
  addHostedTeam(tournamentId: string, name: string): HostedTeam;
  renameHostedTeam(id: string, name: string): void;
  /** Deletes the team and every result it is part of. */
  deleteHostedTeam(id: string): void;
  /**
   * Round robin: stores the result of a pair of teams (replacing the pair's earlier one). `sets`
   * are as seen from `teamId` (`a` = that team); they are stored as seen from the pair's first
   * team in the tournament's order. Does nothing when a team isn't in the tournament, or in a
   * tournament with own matches (those go by `setHostedMatchSets`).
   */
  setHostedResult(
    tournamentId: string,
    teamId: string,
    otherTeamId: string,
    sets: readonly HostedSetScore[],
  ): HostedResult | undefined;
  /** Deletes the result of a pair of teams. */
  deleteHostedResult(tournamentId: string, teamId: string, otherTeamId: string): void;
  /**
   * v15 (app 12.1): adds a match to a tournament with own matches (`plan: 'manual'`); team A is
   * the team given first. Undefined (nothing added) when it can't be (`addMatchError`).
   */
  addHostedMatch(tournamentId: string, teamAId: string, teamBId: string): HostedResult | undefined;
  /** v15: the sets of one added match (none: the match has no result again). */
  setHostedMatchSets(matchId: string, sets: readonly HostedSetScore[]): void;
  /** v15: removes one added match. */
  deleteHostedMatch(matchId: string): void;
  // v16 (app 12.2): a hosted team's optional players, and live scoring
  /** How the team's players are named: by number or by name. */
  setHostedPlayerLabel(teamId: string, label: HostedPlayerLabel): void;
  addHostedPlayer(teamId: string, value: HostedPlayerValue): HostedPlayer;
  /** Replaces the player's number and name (a field left out is removed). */
  updateHostedPlayer(id: string, value: HostedPlayerValue): void;
  /** Deletes the player; rallies that named them keep how the point was won. */
  deleteHostedPlayer(id: string): void;
  /**
   * Stores where live scoring of a match stands (its finished sets and its rallies). `match` is
   * an added match's id, or a round robin's pair with `state` as seen from `teamAId`. A state
   * without anything removes a round robin's result and empties an added match.
   */
  saveHostedLive(match: HostedMatchRef, state: LiveState): void;
  /** Removes a result's rallies and keeps its finished sets, so they can be changed by hand. */
  clearHostedLive(resultId: string): void;
  // whole-data operations (used by import / settings)
  /** Replaces all data; hosted tournaments that are left out are removed. */
  replaceAll(data: TeamCollections & Partial<HostedData>): void;
  resetAll(): void;
  setLanguage(language: Language): void;
  setChipLabel(chipLabel: ChipLabel): void;
  setThemeMode(themeMode: ThemeMode): void;
  setDyslexiaFont(on: boolean): void;
  /** v9.0: chooses a tour and starts it over (clears `tourSeen`). */
  setTourMode(mode: TourMode): void;
  /** v9.0: the page's tips were shown (or offered and answered); they don't come again. */
  markTourSeen(page: TourPage): void;
  setHydrated(value: boolean): void;
  /**
   * v10: one atomic update of data and sync state together. Only the sync engine uses it (it
   * writes pulled records and their bookkeeping in the same `set`).
   */
  syncTransaction(fn: (s: AppState) => Partial<AppState>): void;
  /** v10: links (or with null unlinks) the signed-in account; shared team meta stays. */
  setSyncAccount(account: SyncAccount | null): void;
  /** v10: this installation's random id (set once by the sync engine). */
  setDeviceId(id: string): void;
}

export type AppStore = AppState & AppActions;
