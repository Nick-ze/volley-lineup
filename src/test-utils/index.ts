/**
 * Shared test helpers (v8.3, audit B21–B23). Tests only — excluded from coverage in
 * `jest.config.js`. Import from `@/test-utils` (or the fixture files next to this one).
 *
 * - `seedApp()` seeds a consistent store (profile, team, players, a real season + opponents
 *   via `seasonRefs`, matches) — no more matches pointing at a season that doesn't exist.
 * - `seedGolden()` seeds the export golden data (`src/domain/__golden__/input.json`), the same
 *   data the screenshot script uses.
 * - `renderApp(url)` renders the whole app (Expo Router) at `url` with a hydrated store.
 * - `includeHidden` / `isShown()`: pager pages that are not the shown tab stay mounted but are
 *   hidden from assistive tech; default queries skip them, `includeHidden` finds them too.
 */
import * as fs from 'fs';
import * as path from 'path';

import { isHiddenFromAccessibility } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { TransferData } from '@/domain/exportSchema';
import type { LineupPreset, Match, Player, Position, SetLineup } from '@/domain/types';
import { type Language, resetPhotoStoreForTests, useAppStore, usePhotoStore } from '@/store';

import { seasonRefs } from './seasonRefs';

export { seasonRefs } from './seasonRefs';

/** Query option: also find elements on hidden pager pages (and other hidden elements). */
export const includeHidden = { includeHiddenElements: true } as const;

/** An element returned by an RNTL query. */
export type QueriedElement = NonNullable<Parameters<typeof isHiddenFromAccessibility>[0]>;

/** True when `element` is not hidden from assistive tech (e.g. it is on the shown pager page). */
export const isShown = (element: QueriedElement): boolean => !isHiddenFromAccessibility(element);

/** Resets the app store (keeps device settings, like the app does) and the photo store. */
export function resetStores(): void {
  useAppStore.getState().resetAll();
  resetPhotoStoreForTests();
}

export const PROFILE_ID = 'prof1';
export const TEAM_ID = 'team1';
export const SEASON_ID = 's1';

/** A player of team `team1`; `id` is `p<number>`. */
export const makePlayer = (
  number: number,
  firstName: string,
  positions: Position[],
  overrides: Partial<Player> = {},
): Player => ({
  id: `p${number}`,
  teamId: TEAM_ID,
  firstName,
  lastName: firstName.slice(0, 1),
  number,
  positions,
  active: true,
  ...overrides,
});

/** A set with p1–p6 on court (5-1, setter at 1) and libero p7; override anything. */
export const makeSet = (overrides: Partial<SetLineup> = {}): SetLineup => ({
  formation: { system: '5-1', order: 'outside', setterAt: 1 },
  liberoActive: true,
  setNumber: 1,
  slots: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' },
  liberoId: 'p7',
  weServeFirst: false,
  liberoReplaces: [],
  events: [],
  ...overrides,
});

/** A match for `seedApp`: the season and opponent are filled in from `opponent`. */
export type SeedMatch = Omit<Match, 'teamId' | 'seasonId' | 'opponentId'> & { teamId?: string };

export interface SeedOptions {
  players?: Player[];
  matches?: SeedMatch[];
  presets?: LineupPreset[];
  language?: Language;
}

/**
 * Profile "Coach" (`prof1`, selected) with team "Herren 1" (`team1`), `players`, `presets` and
 * `matches`.
 * Every match is in the team's season "2026" (`s1`) against a real opponent of its name
 * (`seasonRefs`), so the data is consistent like the app's own.
 */
export function seedApp({
  players = [],
  matches = [],
  presets = [],
  language,
}: SeedOptions = {}): void {
  resetStores();
  useAppStore.setState({
    hydrated: true,
    profiles: [{ id: PROFILE_ID, name: 'Coach', color: '#FF6B00', createdAt: '2026-01-01' }],
    teams: [{ id: TEAM_ID, profileId: PROFILE_ID, name: 'Herren 1', createdAt: '2026-01-01' }],
    players,
    presets,
    // The team's season; `seasonRefs` below adds the opponents to it.
    seasons: [
      { id: SEASON_ID, teamId: TEAM_ID, name: '2026', kind: 'season', createdAt: '2026-01-01' },
    ],
    currentProfileId: PROFILE_ID,
    ...(language ? { language } : {}),
  });
  const full = matches.map((m): Match => {
    const teamId = m.teamId ?? TEAM_ID;
    return { ...m, teamId, ...seasonRefs(teamId, m.opponent) };
  });
  useAppStore.setState({ matches: full });
}

const GOLDEN_INPUT = path.join(__dirname, '../domain/__golden__/input.json');

/** The export golden data set (2 profiles, 2 teams, 3 matches, seasons, presets, photos). */
export function goldenData(): TransferData {
  return JSON.parse(fs.readFileSync(GOLDEN_INPUT, 'utf8')) as TransferData;
}

/** Seeds the golden data with profile `pr1` selected (as `scripts/screenshots.js` does). */
export function seedGolden(language: Language = 'en'): TransferData {
  const data = goldenData();
  resetStores();
  usePhotoStore.setState({
    photos: Object.fromEntries(data.photos.map((p) => [p.id, p.dataUri])),
    hydrated: true,
  });
  const { photos: _photos, ...rest } = data;
  useAppStore.setState({ ...rest, hydrated: true, currentProfileId: 'pr1', language });
  return data;
}

/** Renders the whole app at `url` (marks the store hydrated first). */
export function renderApp(url: string) {
  useAppStore.setState({ hydrated: true });
  return renderRouter('./app', { initialUrl: url });
}
