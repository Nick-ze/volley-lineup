import type {
  LineupPreset,
  ManagerProfile,
  Match,
  Opponent,
  Player,
  Season,
  SetLineup,
  Team,
} from '@/domain/types';
import type { PresetLineup } from '@/domain/presets';
import type { ThemeMode } from '@/theme/theme';

/** The persisted data. Bump STORE_VERSION and add a migration when this shape changes. */
export interface AppData {
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  /** v3: saved lineups and the team's starters. */
  presets: LineupPreset[];
  /** v9 (app 7.0): seasons / tournaments and their opponent teams. */
  seasons: Season[];
  opponents: Opponent[];
}

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
  deletePlayer(id: string): void;
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
  // whole-data operations (used by import / settings)
  replaceAll(data: AppData): void;
  resetAll(): void;
  setLanguage(language: Language): void;
  setChipLabel(chipLabel: ChipLabel): void;
  setThemeMode(themeMode: ThemeMode): void;
  setDyslexiaFont(on: boolean): void;
  setHydrated(value: boolean): void;
}

export type AppStore = AppState & AppActions;
