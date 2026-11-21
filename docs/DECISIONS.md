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

## Phase 3/4 — Integration, polish, deploy (orchestrator)

44. **Merge order B → A → C → D** with an independent reviewer per PR; all four passed review after one round of fixes. Branches were rebased onto `main` after each merge; no conflicts.
45. **Header back button** (`src/components/HeaderBack.tsx`, ≥ 44×44) on every screen except the profile picker. With history it goes back; after a reload or deep link it goes to the logical parent (`src/lib/parentRoute.ts`: rotation/starters → match → team's Matches tab → teams → profiles). — The default react-navigation back button is 30×30 and disappears when the stack has only one screen.
46. **Player names on chips sit on a dark pill** — white 11 px text directly on the orange court was ~2.9:1 (fails AA).
47. **Unknown URLs** show an in-app not-found page (`app/+not-found.tsx`) instead of Expo's default.
48. **Disabled/selected state is also exposed as `aria-disabled` / `aria-selected`** on shared `Button` / `PlayerChip`, since react-native-web ignores `accessibilityState`.
49. **GitHub Pages**: the repository is private and Pages was not enabled, and the workflow token cannot enable it ("Resource not accessible by integration"). The deploy workflow builds with `EXPO_BASE_URL=/volley-lineup`, copies `index.html` to `404.html` for deep links, and skips the deploy with a warning until the owner enables Pages (Settings → Pages → Source: GitHub Actions; private repos need a paid plan, or make the repo public). Sub-path build verified locally.
50. **Known limitation (mobile _web_ only)**: on touch browsers, a vertical swipe that starts on a player chip does not scroll the page (the drag handle must block browser scrolling for touch drag to work). Swipe elsewhere to scroll. The native app (Expo Go) uses a 200 ms long-press to start a drag, so scrolling works there.
51. **Android APK built in GitHub Actions** (`.github/workflows/android-apk.yml`): `expo prebuild` + `./gradlew assembleRelease` (JDK 17, arm64-v8a + armeabi-v7a). The workflow runs only on `v*` tags and manual runs (not on pushes to `main`). Releases are versioned: pushing tag `vX.Y.Z` (must match `version` in app.json and package.json) publishes release `vX.Y.Z` with asset `volley-lineup-X.Y.Z.apk`; `android.versionCode` is derived from the version (1.2.3 → 10203) in `app.config.js` so new APKs install as updates. Signed with the Expo template’s fixed debug key — fine for sideloading and updates, not for the Play Store. Package id `com.volleylineup.app`.
52. **Creating a profile opens it straight away**, list rows show a "›" chevron, and the picker says "Tap a profile to open its teams." — On Android a user reported being stuck on the profile screen. An emulator run of the release APK (`.github/workflows/android-smoke.yml`) showed navigation works, but nothing signalled that a profile row opens it (only Rename/Delete looked like actions). The emulator smoke test now also checks team creation and that an app restart lands back on Teams.
53. **Android emulator smoke test is manual-only** (`android-smoke.yml`, `workflow_dispatch`). It builds an x86_64 release APK, boots an API 30 emulator and drives the app with `adb` (`scripts/android-smoke.sh`), failing if an expected screen is missing. Hosted 2-core runners boot emulators slowly and sometimes not at all, so it must not gate PRs. Verified run: profile creation opens Teams, an app restart lands on Teams, no JS errors.

## v2

54. **v2 data model** (orchestrator, before the v2 workers): `SetLineup.liberoReplaces: string[]` and `SetLineup.events: SetEvent[]` (an event log; score/rotation/server/subs are derived by a pure replay function, so undo is "drop the last event"). Export `schemaVersion` 2 — v1 files are upgraded on import (sets get empty `liberoReplaces`/`events`). Store version 2 with a v1→v2 migration; new persisted `language: 'en' | 'de'` (a device setting, not exported, kept on "Delete all data").
55. **Cloud sync is out of scope for v2** — it needs a backend and real accounts, which v1 deliberately avoided (no server, data stays on the device). Export/import remains the way to move data.
56. **Copy from previous set** now also copies whom the libero replaces; the copy's event log starts empty.
57. **Language switching via a `useT()` hook** (`src/i18n/index.ts`): every component calls `const t = useT()`, which subscribes to the store's `language` and returns `en` or `de`. — Each component re-renders on its own when the language changes, including screens kept mounted lower in the navigation stack, without remounting the navigator (which would lose navigation state). Helpers that build text outside a component take the strings as a parameter (`errorText(t, code)`, `startersCardLabel(t, …)`); stored UI messages keep data, not text (`useExport`). ESLint forbids importing `@/i18n/en` in `app/` and `src/` (tests and `src/i18n` excepted), so new UI code can't bypass the setting.
58. **German completeness is enforced by TypeScript**: `Strings = Widen<typeof en>` (string literals → `string`, functions keep their parameters, same keys); `de` and each `de/<feature>.ts` are typed with it, so a missing or extra key fails `npm run typecheck`. Informal "du" form; volleyball terms: Aufstellung, Startaufstellung, Kader, Satz, Aufschlag, Zuspieler, Außenangreifer, Mittelblocker, Diagonalangreifer, Libero, Abwehrspezialist, Heim/Auswärts. Position badge codes (S, OH, MB, OPP, L, DS) are data and stay as they are.
59. **"Language / Sprache"** is a bilingual title in both languages, and the options are always named in their own language (English / Deutsch), so a user who can't read the current language still finds it. On web `<html lang>` follows the setting (`src/lib/documentLanguage(.web).ts`).
