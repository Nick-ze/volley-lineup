# Worker brief (shared by all feature workers)

Repository: `Nick-ze/volley-lineup` (GitHub). Base branch: `main` (foundation commit already there).

## Before you start

1. Read `CLAUDE.md`, `docs/PLAN.md` and `docs/DECISIONS.md` completely. They are binding.
2. You are in your own git worktree. Create your branch from `origin/main`:
   `git fetch origin main && git checkout -B <your-branch> origin/main`
3. `npm ci` (Node 22). The sandbox cannot reach api.expo.dev, so if you need a new Expo package use
   `EXPO_OFFLINE=1 npx expo install <pkg>` and record why in your PR (the orchestrator adds it to DECISIONS.md).
   Avoid new dependencies unless really needed.

## What already exists on main (use it, don't duplicate it)

- `src/domain/types.ts` — the data model (+ `CourtPosition`, `SetNumber`, `COURT_POSITIONS`, `SET_NUMBERS`, `ALL_POSITIONS`). Never redefine these types.
- `src/domain/lineup.ts` — `emptySetLineup(setNumber)`.
- `src/domain/lineupValidation.ts` — validation contract (`validateLineup(set, players): ValidationResult`, error/warning codes). Stub on main; Worker B implements it.
- `src/store` — `useAppStore` (Zustand + AsyncStorage persist). Actions: `addProfile/updateProfile/deleteProfile/selectProfile`, `addTeam/updateTeam/deleteTeam`, `addPlayer/updatePlayer/deletePlayer`, `addMatch/updateMatch/deleteMatch`, `setLineup(matchId, set)`, `replaceAll(data)`, `resetAll()`. Hooks: `useTeamsForProfile`, `usePlayersForTeam`, `useMatchesForTeam`, `useTeam`, `useMatch`, `usePlayer`, selectors `selectCurrentProfile`, `selectAppData`. **Zustand v5: never return a freshly built array/object from a `useAppStore` selector without `useShallow`** (infinite render loop) — use the hooks.
- `src/components` — `Button` (variants primary/secondary/ghost/danger), `PlayerChip`, `PositionBadge`, `Court` (`renderSlot`, `slotStyle`, `slotRef`; net on top, front row 4-3-2, back row 5-6-1), `Screen` (safe area + dark bg + max width + optional scroll), `Placeholder`.
- `src/lib/id.ts` `createId()`, `src/lib/useIsWide.ts` (≥768 px).
- `src/theme` — `colors`, `positionColors`, `profileColors`, `spacing`, `radius`, `touchTarget` (44), `typography`, `fontSize`. Text on orange/yellow must be `colors.onPrimary` (near-black).
- `src/i18n/en.ts` exports `t`. **Put your strings in your own file `src/i18n/en/<yours>.ts`** (already created & wired into `t`), e.g. `t.roster.addPlayer`. Functions for interpolation are fine.
- `app/` — every route exists as a placeholder and is registered in `app/_layout.tsx` (Stack). Set per-screen titles/header buttons inside your screen with `<Stack.Screen options={...} />` rather than editing `_layout.tsx`.

## Routes

`/` profile picker · `/teams` · `/team/[teamId]` (Roster | Matches) · `/team/[teamId]/player?playerId=` (modal add/edit) · `/team/[teamId]/match-new` (modal) · `/match/[matchId]?set=N` (set tabs + lineup builder) · `/match/[matchId]/rotation?set=N` · `/match/[matchId]/starters` · `/settings`.

## Testing notes

- React Native Testing Library **v14 is async**: `await render(...)`, `await fireEvent.press(...)`, `await fireEvent.changeText(...)`. Read `node_modules/@testing-library/react-native/docs/` if unsure.
- Route-level tests: `renderRouter` from `expo-router/testing-library` (see `__tests__/navigation.test.tsx`; set `useAppStore.setState({ hydrated: true })` first).
- AsyncStorage is mocked in `jest.setup.ts`. Reset the store in `beforeEach` with `useAppStore.getState().resetAll()`.
- `src/domain` must stay at 100% coverage (enforced by `jest --coverage`, which CI runs).

## Rules

- Stay inside the files you own. Shared files (`src/domain/types.ts`, `src/theme/*`, `src/store/*`, `src/components/*`, `app/_layout.tsx`) only if unavoidable, minimal, and listed in your PR description.
- No hard-coded colours, spacing or user-facing text. Every interactive element has `accessibilityLabel`; touch targets ≥ 44×44.
- Components small (< ~150 lines); logic in `src/domain` as pure tested functions.
- Platform-specific code in `src/lib/*.web.ts` / `*.native.ts`, never scattered `Platform.OS` checks.

## Definition of done

1. `npm run lint && npm run typecheck && npm test -- --coverage && npx expo export -p web` all pass.
2. Browser check where possible: `npx serve -s dist -l <port>` and drive it with Playwright (`require('playwright')` works; Chromium preinstalled — do not run `playwright install`). Take a 375-px-wide and a 1280-px-wide screenshot.
3. Small, clear commits (`feat(roster): ...`), commit messages end with the attribution lines you were given.
4. Push your branch (`git push -u origin <branch>`, retry up to 4× on network errors) and open a PR into `main` with the GitHub MCP tool `mcp__github__create_pull_request` (load it via ToolSearch). PR body: what changed, how it was tested, UI notes, acceptance items covered, shared files touched, dependencies added, decisions made. End the PR body with the attribution lines you were given.
5. Do NOT merge. Final report: branch, PR URL, done / not done, open questions, decisions you made.
