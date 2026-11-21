# Worker brief (shared by all feature workers)

Repository: `Nick-ze/volley-lineup` (GitHub). Base branch: `main`. Current state: v3 (app 3.0.0).

## Before you start

1. Read `CLAUDE.md`, `docs/HANDOFF.md` (§3 architecture, §6 gotchas), `docs/PLAN.md` (§15–17 for v3) and the entries of `docs/DECISIONS.md` that touch your files (v3: #88–93). They are binding.
2. You are in your own git worktree. Create your branch from `origin/main`:
   `git fetch origin main && git checkout -B <your-branch> origin/main`
3. `npm ci` (Node 22). The sandbox cannot reach api.expo.dev, so if you need a new Expo package use
   `EXPO_OFFLINE=1 npx expo install <pkg>` and say why in your PR. Avoid new dependencies.

## What already exists on main (use it, don't duplicate it)

- **Data model v4** — `src/domain/types.ts` is the only place for types (`ManagerProfile`, `Team`, `Player`, `Match`, `SetLineup`, `SetEvent = PointEvent | SubEvent`, `PointKind`, `LineupPreset`, `ExportFile`, `CourtPosition`, `SetNumber`, `COURT_POSITIONS`, `SET_NUMBERS`, `ALL_POSITIONS`). A set's score, rotation, server and subs are replayed from its `events`. v4 point events may carry `kind`, `playerId` and `at` (ISO time, for the match duration) — DECISIONS #88–91. Store version **4** (`src/store/migrations.ts`), export `schemaVersion` **4** (`src/domain/exportSchema.ts`; v1–v3 files are upgraded on import). Changing the persisted shape needs both bumps plus migrations and tests (HANDOFF §6).
- **Domain** (`src/domain/`, pure, 100% coverage enforced by `jest --coverage`):
  - `rotation`, `lineup` (`emptySetLineup`), `lineupValidation`, `lineupEditing`, `lineupLock` (played sets are locked, #68), `liberoSwap`, `templates` (5-1 / 6-2), `roster` (form validation), `playerUsage`.
  - `liveSet` — replay of a set's event log (`replaySet`, `addPoint`, `addSub`, `undo`, `targetPoints`, `setWinnerOf`).
  - `matchState` — results, derived and never stored: `setScore`, `setWinner`, `setResult`, `getMatchState(match) → { sets, setsWon, winner, status, currentSetNumber, durationMs }`, `lastPlayedSetNumber`.
  - `pointTags` — which `PointKind` belongs to which winner, which kinds name a player (`pointKindsFor`, `kindTakesPlayer`, `isValidPointTag`, `tagLastPoint`).
  - `presets` — saved lineups and team starters (apply, validate names, pre-fill new matches).
  - `exportSchema` (zod + file upgrades + merge), `lineupSheet` (print HTML; every user text HTML-escaped, #57).
- **Being built in v3 (not on `main` yet)**: `src/domain/stats.ts` — all statistics, including the tag totals (#92) — and the team `stats` tab / `/match/[matchId]/stats` screen (the route exists as a placeholder).
- **Store** (`src/store`) — one `useAppStore` (Zustand v5 + AsyncStorage persist): profiles, teams, players, matches, presets, `currentProfileId`, `language`, `hydrated`. Actions in `src/store/types.ts` (`add/update/delete` for each collection, `setLineup`, `addPreset/updatePreset/deletePreset/setStarters`, `replaceAll`, `resetAll`, `setLanguage`). Hooks in `src/store/hooks.ts` (`useTeamsForProfile`, `usePlayersForTeam`, `useMatchesForTeam`, `usePresetsForTeam`, `useStarters`, `useTeam`, `useMatch`, `usePlayer`, `usePreset`). **Never return a freshly built array/object from a `useAppStore` selector without `useShallow`** (infinite render loop) — use the hooks.
- **Components** (`src/components`) — `Button` (primary / secondary / ghost / danger, `compact`), `Court`, `PlayerChip`, `PositionBadge`, `Screen`, `HeaderBack`, `ToggleRow`, `Placeholder`. In-app dialogs use RN `Modal` (see `src/features/roster/components/ConfirmDialog.tsx`); never `Alert.alert` (does nothing on web).
- **Theme** (`src/theme`) — `colors`, `positionColors`, `profileColors`, `spacing`, `radius`, `touchTarget` (44), `wideBreakpoint`, `dialogMaxWidth`, `maxContentWidth`, `typography`, `fontSize`; `print.ts` is the light print theme. Text on orange/yellow is `colors.onPrimary`.
- **Platform code** only in `src/lib/*.web.ts` / `*.native.ts` (file transfer, print, drag activation, switch props, document language). Also `src/lib/id.ts` `createId()`, `src/lib/useIsWide.ts`, `src/lib/measureInWindow.ts` (drag and drop hit areas) and `src/lib/parentRoute.ts` (where "Back" goes when there is no history).

## Strings (i18n)

- Components read strings with `const t = useT()` from `@/i18n`; helpers outside React take `t: Strings` as a parameter (or use `stringsFor(language)`).
- Each feature has `src/i18n/en/<x>.ts` and `src/i18n/de/<x>.ts`; the German file is typed `export const x: Strings['x'] = { … }`, so a missing key fails typecheck. Functions for interpolation are fine. German uses informal "du"; volleyball terms as in DECISIONS #70.
- ESLint forbids importing `@/i18n/en`, `@/i18n/en/*`, `@/i18n/de` or `@/i18n/de/*` from `app/` and `src/` (tests may import `en` / `de` to match text).

## Routes

`/` profile picker · `(tabs)`: `/teams`, `/profile`, `/settings` · `/team/[teamId]?tab=roster|matches|presets|starters` (v3 adds `|stats`) · `/team/[teamId]/player` (modal) · `/team/[teamId]/match-new` (modal) · `/team/[teamId]/preset/[presetId]` · `/team/[teamId]/starters` · `/match/[matchId]?set=N` (lineup builder) · `/match/[matchId]/rotation|starters|live|stats` · `+not-found`. Every route is registered in `app/_layout.tsx`; new routes are added there by the orchestrator (in the foundation PR), not by workers. Set a screen's title and header buttons with `<Stack.Screen options={...} />` inside the screen itself.

## Testing notes

- RNTL **v14 is async**: `await render(...)`, `await fireEvent.press(...)`, `await fireEvent.changeText(...)`.
- Route tests: `renderRouter` from `expo-router/testing-library` (see `__tests__/navigation.test.tsx`), with `useAppStore.setState({ hydrated: true })` first.
- AsyncStorage is mocked in `jest.setup.ts`. Reset the store in `beforeEach` with `useAppStore.getState().resetAll()`.
- Never weaken or delete an existing test; if an expectation legitimately changes, say why in the PR.

## Rules

- Stay inside the files you own. Shared files (`src/domain/types.ts`, `src/theme/*`, `src/store/*`, `src/components/*`, `app/_layout.tsx`) only if unavoidable, minimal, and listed in your PR.
- **Don't edit `docs/DECISIONS.md`, `docs/PLAN.md`, `docs/HANDOFF.md` or `README.md`** — list your decisions in the PR body; the orchestrator records them.
- No hard-coded colours, spacing or user-facing text. Every interactive element has an `accessibilityLabel`; touch targets ≥ 44×44. react-native-web ignores `accessibilityState` → also set `aria-checked` / `aria-selected` / `aria-disabled`.
- Components small (< ~150 lines); logic in `src/domain` as pure tested functions. No `any`, no `@ts-ignore`.

## Definition of done

1. `npm run lint && npm run typecheck && npm test -- --coverage && npx expo export -p web` all pass.
2. Browser check: `npx serve -s dist -l <free port>` and drive it with Playwright (`require('playwright')`; Chromium is preinstalled — never run `playwright install`). Check at 390×844 (or 375 px wide) and at 1280 px, in English and German (Settings → Language). Screenshots go in your own subfolder of the session scratchpad, never in the repo.
3. Small, clear commits (`feat(live): ...`); commit messages end with the attribution lines you were given.
4. Push (`git push -u origin <branch>`, retry up to 4× on network errors) and open a PR into `main` with the GitHub MCP tool `mcp__github__create_pull_request` (load it via ToolSearch). PR body: what changed, how it was tested, UI notes, acceptance items covered (PLAN §17), shared files touched, dependencies added, decisions made; end it with the attribution lines you were given.
5. Do NOT merge. Final report: branch, PR URL, done / not done, decisions, open questions.
