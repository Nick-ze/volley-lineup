# Decisions

Choices made where `docs/PLAN.md` / `CLAUDE.md` were silent or needed interpretation.
Newest at the bottom. Format: **Decision** — why.

## Phase 0 — Foundation (orchestrator)

1. **`CLAUDE.md` moved from `docs/` to the repository root.** — It was uploaded into `docs/`; agents and the plan expect it at the root. `docs/ORCHESTRATOR_PROMPT.md` is kept unchanged.
2. **Expo SDK 58** (latest stable on npm at build time: expo 58.0.26, React Native 0.88, React 19.3, TypeScript 6). — Plan says "latest stable SDK". Expo Go on the phone must be a build that supports SDK 58.
3. **Scaffolded from `create-expo-app` default template, then stripped.** Removed example screens and template-only packages (`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-image`, `expo-device`, `expo-web-browser`) to keep the dependency list minimal. React Compiler experiment is off (fewer moving parts while debugging gestures).
4. **Routes live in root `app/`** (as in `CLAUDE.md`), not the template's `src/app/`. `@/*` maps to `./src/*`.
5. **Web output `single`** (one `index.html` SPA) instead of `static`/`server`. — GitHub Pages is static hosting; all data is client-side, and dynamic routes (`/team/[teamId]`) can't be pre-rendered. Deep links on Pages are handled by copying `index.html` to `404.html` at deploy time.
6. **Dependencies added** (all via `EXPO_OFFLINE=1 npx expo install`, because the sandbox can't reach `api.expo.dev`; versions come from Expo's bundled compatibility list):
   - `zustand` — state (plan). `@react-native-async-storage/async-storage` — persistence (plan).
   - `zod` — import-file and form validation (plan).
   - `expo-crypto` — `randomUUID` ids (plan).
   - `expo-file-system`, `expo-sharing`, `expo-document-picker` — native export/import (plan).
   - Dev: `jest`, `jest-expo`, `@testing-library/react-native` v14 (+ its peer `test-renderer@1.3`), `eslint`, `eslint-config-expo`, `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier`, `@types/jest`.
7. **RNTL v14 is async**: `await render(...)`, `await fireEvent.press(...)`. — v14 is the version compatible with React 19.3.
8. **One Zustand store (`useAppStore`)** holding profiles/teams/players/matches + `currentProfileId`, persisted under AsyncStorage key `volley-lineup`, store version `1` with a `migrateStore` hook (`src/store/migrations.ts`). `hydrated` is runtime-only; the root layout shows a spinner until rehydration finishes so screens never render empty data first.
9. **Cascading deletes**: deleting a profile deletes its teams; deleting a team deletes its players and matches; deleting a player clears it from every lineup slot/libero of that team's matches.
10. **New matches start with one set (set 1, empty, we serve first).** Further sets are added when the user opens the set tab (`setLineup` inserts/replaces by `setNumber`, sorted). `Match.sets` stays length 1–5.
11. **Zustand v5 + derived arrays**: list selectors are exposed as hooks in `src/store/hooks.ts` using `useShallow`, to avoid the infinite re-render trap of returning fresh arrays.
12. **Strings split per feature**: `src/i18n/en.ts` holds shared strings and merges `src/i18n/en/{roster,lineup,rotation,transfer}.ts`. — Four workers adding strings to one file would conflict constantly. Everything is still reached through `t` from `src/i18n/en.ts`.
13. **Validation contract defined up front** in `src/domain/lineupValidation.ts` (stub on `main`): `validateLineup(set, players): ValidationResult` returning error/warning **codes** (no text in the domain layer; UI maps codes to i18n strings).
14. **Screens / routes**:
    `/` profile picker · `/teams` · `/team/[teamId]` (Roster | Matches tabs) · `/team/[teamId]/player?playerId=` (modal, add/edit) · `/team/[teamId]/match-new` (modal) · `/match/[matchId]?set=N` (Match screen = set tabs + lineup builder, i.e. plan screens 5 and 6 combined) · `/match/[matchId]/rotation?set=N` · `/match/[matchId]/starters` · `/settings`.
    — Combining Match + Lineup builder saves a navigation step; the set tabs sit directly above the court.
15. **Court orientation**: net at the top, front row 4-3-2 directly under it, back row 5-6-1 below (as seen from behind our own baseline). Orange court, white lines/net.
16. **Text on orange/yellow is near-black (`#0D0D0D`)**, not white — white on `#FF6B00` is ~2.9:1 and fails WCAG AA; black is ~7:1. Blue `#0057B8` is only used as a fill; text/links use `#3D8BFF`.
17. **Position badge colours**: S yellow, OH light blue, MB green, OPP purple, L white, DS grey — all with near-black text (AA).
18. **Wide layout breakpoint 768 px** (`useIsWide()`): court left, bench right above it; stacked below.
