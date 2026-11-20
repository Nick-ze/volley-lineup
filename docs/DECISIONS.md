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
19. **Jest infrastructure** — `jest.setup.ts` mocks `react-native-worklets` with its shipped mock and stubs Reanimated's `initializeReanimatedModule` (it throws on `setCSSEventHandler` under JSReanimated in 4.7), so `react-native-reanimated/mock` loads and gesture-handler v3 hooks work in tests. Global test timeout 30 s, because route-level `renderRouter` tests take > 5 s on a cold cache. `.claude/` (agent worktrees) is ignored only at the repo root.

## Phase 1 — Feature decisions (from worker PRs)

### Rotation & validation (Worker B, PR #2)

20. **`NO_SETTER`** is only raised once at least one slot is filled. A secondary `S` position counts as a setter; unknown ids don't.
21. **`UNUSUAL_LAYOUT`** looks only at primary positions. It fires when the single primary S and the single primary OPP aren't opposite (positions differ by 3), or when exactly two primary MBs aren't opposite. A 6-2 (two setters) gives no layout warning.
22. **Issue grouping**: `INCOMPLETE` is one issue listing all empty positions; `DUPLICATE_PLAYER` is one per duplicated player; `UNKNOWN_PLAYER` is one per slot plus one for the libero.
23. **`getRotation(slots, n)`** accepts only 1–6 (throws `RangeError`); `rotateBy` takes any integer and wraps.
24. **Swipe**: left = next rotation, right = previous, 50 px threshold. Prev/Next buttons and a 1–6 stepper always work.
25. **Server highlight**: position 1 is always marked as server (plan §3.6). When the opponent serves first, the set shows "We receive first" instead of changing the highlight.
26. **Court contrast**: the court's own position numbers are hidden in the rotation screens; spots use blue (front row) / dark (back row) fills with white text, since white on orange fails AA.

### Profiles, teams & roster (Worker A, PR #3)

27. **"Injured" = `active: false`** — the data model has one flag.
28. **Startup redirect**: `/` forwards to `/teams` once per app session, only if `currentProfileId` points to an existing profile. The first visit to any roster screen consumes it, so deep links never cause a later redirect.
29. **Form limits**: jersey number 0–99 (unique per team, excluding the player being edited), names ≤ 40 characters, season optional ≤ 20 characters, at least one position (first = primary).
30. **New match** replaces the modal with the match screen, so Back from the match goes to the team.
31. **Confirm dialogs are in-app** (`Alert.alert` does nothing on web).
32. **react-native-web ignores `accessibilityState`** — roster controls also set `aria-checked` / `aria-selected`. The whole switch row is the touch target (≥ 44 px); the web Switch thumb colour is passed via `src/lib/switchProps(.web).ts`.

### Lineup builder (Worker C, PR #4)

33. **A set is stored on its first real edit**, not when its tab is opened, so browsing never creates empty sets and `match.sets` stays ≤ 5 and sorted.
34. **Copy from previous set** copies the six starters and the libero, not the serve choice.
35. **Making a court player the libero** sends the old libero to the bench.
36. **Drag activation**: on web after 6 px of mouse movement; on phones after a 200 ms long-press so swipes still scroll (`src/lib/dragActivation(.web).ts`). A press within 250 ms after a drag is ignored. Drops are hit-tested on the JS thread against measured zones (`src/lib/measureInWindow.ts`).
37. **Layout**: on phones the whole page scrolls and the bench is a wrapping grid; on wide screens the bench scrolls on its own (gesture-handler `ScrollView`).

### Export / import (Worker D, PR #1)

38. **Merge** matches items by id and the imported one wins; nothing is deleted. If the result would be inconsistent (e.g. two players with the same number in a team), the merge is refused with `MERGE_CONFLICT` and the user is told to use Replace.
39. **Unknown keys in a file are dropped**, not rejected. Import validates references (ids, team/profile links, jersey numbers, set numbers, lineup players belonging to the team, no player twice in a set, libero not on court), but not the soft lineup warnings.
40. **Sets are sorted by `setNumber` on import.**
41. **After an import**, if no valid profile is selected and the data has exactly one profile, it is selected. Otherwise the user picks one.
42. **Switch profile** in Settings clears the selection and returns to `/`. **Delete all data** stays on Settings so the user can import straight away.
43. **Native picker accepts any file type** (Android often mislabels `.json`); validation rejects anything that isn't a Volley Lineup file.
