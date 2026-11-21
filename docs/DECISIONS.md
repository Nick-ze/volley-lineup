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
12. **Strings split per feature**: `src/i18n/en.ts` holds shared strings and merges `src/i18n/en/{roster,lineup,rotation,transfer}.ts`. — Four workers adding strings to one file would conflict constantly. (v2: components get the strings for the current language with `useT()` from `src/i18n`; see #69.)
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

### Printable lineup sheet (PR #11)

57. **Print theme**: black on white, A4 portrait, separate from the dark app theme (`src/theme/print.ts`). The sheet HTML is built by a pure function (`src/domain/lineupSheet.ts`); every piece of user text is HTML-escaped.
58. **Web prints from a hidden iframe** (not `window.print()` on the app page), so web and phone use the same HTML; the page title is swapped to the sheet title while the dialog is open. **Phone**: `expo-print` → A4 PDF (34 pt margins) → share sheet; the PDF keeps the file name `expo-print` generates.
59. **Content**: only stored sets are printed ("No lineups yet" otherwise); court grid per set, libero, "Libero replaces #x, #y", who serves first; roster of all team players with position codes and injured marker. A 5-set match with 12 players fits one A4 page; long rosters break across pages.
60. **New dependencies**: `expo-print` (PDF on phones); dev `jsdom` + `@types/jsdom` (declared explicitly for the web print test; they were already present transitively via jest-expo).

### Libero swaps + 5-1 / 6-2 templates (PR #13)

61. **Libero swap rule**: the libero stands in for a chosen starter at back-row positions 5 and 6, and at position 1 only when that position is not serving. The rotation viewer treats position 1 as serving. One libero: if two chosen starters are in the back row, the first in `liberoReplaces` is replaced.
62. **Default "libero replaces"**: the primary middle blockers, pre-selected only when a libero is first assigned and nobody is chosen; later choices (including nobody) are kept; "Suggest middles" re-applies it. `liberoReplaces` only ever lists players on court.
63. **Template layouts** (rotation 1, setter serving): 5-1 = S1 · OH2 · MB3 · OPP4 · OH5 · MB6; 6-2 = S1 · OH2 · MB3 · S4 · OH5 · MB6 (hitter spots take an OH, else an OPP). Picked by primary position, then fallback role, then secondary position, lowest number first; only active players, never the libero or a primary-L player. Filling keeps libero, serve choice and events, resets `liberoReplaces` to the new middles, and is disabled for played sets.
64. **"Show libero swaps" toggle** in the rotation viewer: on by default, not persisted. The starters overview shows the base lineup. `ToggleRow` became a shared component (`src/components`).

### Live match + substitutions (PR #12)

65. **Set point = one point from winning**: target − 1 or more and ahead (target 25, 15 in set 5, win by 2, deuce included). PLAN §11.3's "2-point lead" would describe a set already won. Set ends are not enforced; a won set shows "won the set".
66. **Substitutions**: max 6 per set (`SUB_LIMIT` warning beyond); re-entry rule pairs a substitute with the player they replaced, and only that pair may swap back, once (`REENTRY_RULE`). Warnings never block; bench chips preview the warning before the tap. Impossible subs are skipped (`INVALID_SUB`). The libero is never a sub; tapping the libero on the live court substitutes the real player they stand in for.
67. **Live state** is replayed from `events` by `replaySet` (fields `slots`, `serverId`, `rotation`, `setPoint`, `setWinner`, … — named slightly differently from the PLAN §12 sketch). Live mode needs all six positions filled. `liberoReplaces` refers to starters: a substitute for a chosen middle isn't swapped for the libero.
68. **Lineup lock**: once a set has live events, its starting six, libero and first serve can't be edited (the replay depends on them); "whom the libero replaces" stays editable. "Reset live data" in live mode (with confirmation) clears the events and unlocks it. A rally, Undo, Reset or switching sets cancels a half-finished substitution.

### German translation (PR #14)

69. **`useT()` hook** (`src/i18n/index.ts`): components read the strings for the store's `language`, so every mounted screen re-renders on a switch without remounting navigation. Helpers outside components take `t` as a parameter; UI state keeps data, not finished text. An ESLint rule forbids importing `src/i18n/en` / `de` directly from `app/` and `src/` (tests and `src/i18n` exempt).
70. **German completeness is enforced by the compiler**: `Strings` is the widened shape of the English strings, and `de.ts` plus `de/*.ts` are typed with it, so a missing or extra key fails typecheck. Informal "du"; volleyball terms Zuspieler, Außenangreifer, Mittelblocker, Diagonalangreifer, Libero, Abwehrspezialist.
71. **Language / Sprache** in Settings (English / Deutsch), persisted, kept on "Delete all data"; `<html lang>` follows it on web; the printed sheet follows it too. Position badges keep the international codes (S, OH, MB, OPP, L, DS) in both languages.
72. **Version 2.0.0**: `version` in `app.json` / `package.json` bumped (Android `versionCode` 20000, so it installs as an update over 1.0.0).
73. **Deleting a player** clears every reference to them (court, libero, "libero replaces", substitution events) via `removePlayerEverywhere`, so exports stay importable. Deleting a player who is part of a **played** set is blocked with an explanation (mark them injured, or reset that set's live data) — removing them would rewrite the set's score history.
74. **Locked lineup controls** (court slots, libero slot, bench target, chips, serve toggle) report `disabled` to assistive tech while a set has live data. List-row actions wrap below the name on narrow screens instead of truncating it.

## v2.1

75. **Phone lineup layout**: below 768 px the order is court → libero + serve → bench → instructions → templates / copy / clear → checks, with compact sizes (48 px chips, 76 px court slots, compact libero row). The court, libero and a 10–12-player bench fit on one 390×844 screen without scrolling. Wide screens are unchanged (court left, bench right).
76. **Bottom tab bar** (Teams · Profile · Settings) via a route group `app/(tabs)/` with `expo-router/js-tabs`, so URLs stay the same (`/teams`, `/settings`, new `/profile`). Detail screens (team, match, rotation, live, …) open over the tabs with their back button and no tab bar. 56 px bar + bottom safe area; Ionicons from `@expo/vector-icons` (new dependency — tab icons).
77. **Profile tab**: shows the current profile (avatar, name, team/player counts), edits name and colour inline, **Log out**, and Delete profile (with confirmation). It replaces the profile section in Settings and the "Switch profile" / header "Settings" buttons on Teams (amends #42).
78. **Log out** clears the selected profile and returns to the profile picker with no history behind it; it is also the way to switch profile (there are no passwords — data stays on the device, see §2 of the plan). The tabs layout marks the startup redirect as handled, so the picker never jumps back into a profile after logging out (amends #28).
79. **Version 2.1.0**: phone lineup layout (#75) + tab bar / profile / log out (#76–78).

## v2.2 — Team nav bar, presets and starters (PR #21)

80. **Team nav bar** (Roster · Matches · Presets · Starters) is a component inside the team screen, not a nested navigator; the tab is kept in `?tab=` (unknown → roster). It replaces the old Roster | Matches switch.
81. **Data model v3**: `LineupPreset { id, teamId, name, kind: 'starters' | 'preset', slots, liberoId, liberoReplaces, createdAt }` in a `presets` collection; at most one `starters` preset per team. Store version 3 (v2→v3 migration adds `presets: []`), export `schemaVersion` 3; v1 and v2 files are upgraded on import.
82. **Team starters** have their own editor route (`/team/[teamId]/starters`), an empty name with a fixed label, and are saved on the first edit. Starters with nothing filled count as "no starters". **New matches** pre-fill set 1 from complete starters; injured starters are left out (their spots stay empty), and the Starters tab says how many would be left out.
83. **Presets**: created with a name first (default "Preset n"), edited with the lineup builder (preset mode hides the serve toggle and copy-previous), auto-saved; copy → "X (copy)". Names are required, ≤ 40 characters and unique per team ignoring case — also checked on import.
84. **Applying** a preset or the starters to a match set copies court, libero and "libero replaces" exactly, keeps the set's serve choice and events, skips inactive or removed players (with a message), never places anyone twice, and is disabled for played sets (#68). Reasons for disabled buttons are given as accessibility hints, not as permanent text.
85. **Merging an import**: a file's team starters replace that team's existing starters (even under a different id); a second preset with an existing name is a `MERGE_CONFLICT` (like jersey numbers). The merge hint says so. Presets never block deleting a player; deleting a player removes them from all presets.
86. The match lineup logic moved from `useLineupEditor` into a generic `useLineupDraft` used by both the match screen and the preset editor (no behaviour change for match sets).
87. **Version 2.2.0** (versionCode 20200).

## v3 — Match day & stats

### Foundation (orchestrator)

88. **Data model v4**: point events gain optional `kind` (`PointKind`), `playerId` and `at` (ISO time the rally was recorded). Store version 4 — the v3 → v4 step changes nothing, old events stay valid as they are; export `schemaVersion` 4 — v1, v2 and v3 files are upgraded on import. `SetEvent` is now `PointEvent | SubEvent` (named interfaces, same shape).
89. **Point tags** (`src/domain/pointTags.ts`): us → kill / ace / block / opponentError; them → ourError / opponentKill / opponentAce. Only kill, ace, block and ourError may name a player; a player without a kind is invalid. Import rejects incoherent tags and tagged players of another team as `INCONSISTENT_REFERENCES`. A player named in a tag of a played set can't be deleted (extends #73); `removePlayerEverywhere` (defensive) keeps the rally and its kind and drops only the player.
90. **Results are derived, never stored** (`src/domain/matchState.ts`): a set is won at 25 (15 in set 5) with a 2-point lead; the match at 3 sets. The current set is the first set (1–5) nobody has won yet, stored or not. Sets stored after the deciding set (only possible in pre-v3 data) are ignored for the result.
91. **Match duration** = first to last timestamped rally of the counted sets. Rallies recorded from v3.0 carry `at`; matches played before have no duration (shown as nothing, not "0 min").
92. **All statistics, including the tag totals, are computed in `src/domain/stats.ts`** (one place, as the plan says); the point-tagging worker builds the tagging UI and uses those totals.
93. **Version 3.0.0** (Android versionCode 30000). Major version because the store and export formats change (older apps can't open v4 data).

### Statistics (PR #26)

94. **Rotation of a rally** = the rotation it was played in, before the side-out it causes. Received = the opponent served; side-out % = received rallies won ÷ received (shown "–" when nothing was received); break point = a rally won on our serve. Computed by `src/domain/stats.ts` from `replaySteps` (an additive export of `liveSet.ts`; `replaySet` unchanged).
95. **What counts**: a set counts once it has a rally, and only sets that count for the result (#90). Subs in a set without rallies count for nobody; in a played set every applied sub counts (skipped `INVALID_SUB` don't; `SUB_LIMIT` / `REENTRY_RULE` ones do).
96. **Started** = in the stored starting six; **played** = among the six for ≥ 1 rally. The **libero** counts as started and played only if their swap applied in at least one rally.
97. **Serve turn** = a run of our serves by the same server (starts at our first serve and after each side-out; substituting the server starts a new turn for the new server; a server swapped out before serving gets none; out and back with the substitute serving in between = two turns). Points on serve = rallies won while that player served. Tag totals count only tags that name a player.
98. **Stats tab** (5th team nav item, `?tab=stats`): season tiles (record W–L, "n in progress" separately, sets and points won : lost; matches without rallies aren't counted), rotation table, player table. **Match stats** `/match/[matchId]/stats` with a local set filter (All / Set N). Header title is fixed ("Match stats"); the opponent is a heading in the content. Tables keep the first column fixed and scroll the number columns sideways; abbreviations are explained in a legend and in each row's screen-reader summary (EN W L SO% BP · St Pl In Out Sv SvP K A B E; DE G V SO% BP · Sta Gsp Ein Aus Auf AuP Ang Ass Blo Feh).

### Polish (PR #25)

99. **Print with results**: only for a played match (`status !== 'notStarted'`), Print first offers _With results_ / _Lineups only_ / _Cancel_ (in-app dialog). The results section (above the sets) shows won / lost / in progress, sets won, every started set's score (open set marked "in progress") and the duration rounded to minutes, hidden under 1 minute. Unplayed matches print exactly as before.
100. **"Delete all data"** text names saved lineups (presets and team starters) — "gespeicherte Aufstellungen (Vorlagen und Startsechs)". `docs/WORKER_BRIEF.md` rewritten for v3.

### Whole-match live mode (PR #27)

101. **Live mode follows the match**: the scoreboard shows "Sets x:y"; a won set replaces the point buttons with "Set won by …" + **Start set N+1** + **Undo last point** — no rallies or substitutions in a won set (court read-only). At 3 sets a **match summary** shows the result, every set's score and the duration (hidden without 2 timestamps or under 1 minute, rounded to minutes). Opening live mode without a valid `?set` (and the match screen's Live button) goes to the current set, or to the summary when the match is over; the set picker still browses earlier sets ("Go to set N").
102. **Next set setup** inside live mode, for the current set when it isn't stored or is incomplete with nothing recorded: Team starters (if complete) / each preset / Copy set N (applied like the builder: injured or removed players left out, nobody twice), a serve choice, Start (enabled at 6/6), Edit lineup (opens the builder; saves the draft only if something was chosen). The setup is a local draft saved on Start.
103. **Serve default for a new set**: whoever received first in the previous set serves first (set 5 too; the toggle covers a coin toss). A stored set without rallies gets this default when reached from the previous set; a choice made in the setup panel wins. A complete set without rallies goes straight to live play with a serve toggle until the first rally (no extra tap for set 1).
104. **Undo across a set end**: from an untouched next set, the setup panel or the summary, Undo removes the last rally of the previous played set and returns to it (re-opening it). In an earlier won set Undo is hidden once a later set has rallies.
105. **Pre-v3 data**: a set stored after the deciding set shows "Played after the match was decided — not counted" and no live controls.
106. **Result labels** ("3:1 won", "1:3 lost", "2:1 · in progress", nothing before the first rally) on their own line in the match list (also in the row's screen-reader label) and under the set tabs on the match screen. The match screen's five links are one row on wide screens and 3 + 2 on phones.

### Point tagging (PR #28)

107. **Tag row** after every rally: Point us → Kill · Ace · Block · Opp. error · ✕; Point them → Our error · Their kill · Their ace · ✕ (DE: Angriff · Ass · Block · Gegn. Fehler / Eigenfehler · Gegn. Angriff · Gegn. Ass). Only plausible kinds are offered: no "Ace" when we didn't serve that rally, no "Their ace" when we did (`plausibleKinds`, `src/domain/lastRally.ts`; import validation stays as in #89). A kind is saved immediately (`tagLastPoint`); tapping it again clears it.
108. **Never required**: the row refers only to the rally just recorded; the next rally replaces it, and a substitution, undo, reset, ✕ or switching sets closes it (it doesn't reopen for an earlier rally after undo). It also appears under the set-won panel and the match summary, so the winning rally can be tagged; undo labels name the tag ("· kill #7 Smith").
109. **Player picker** (kill / ace / block / our error) offers the players on court _during_ that rally — before its side-out rotation, with that moment's libero swap — and replaces the chip row to save height; it stays open so a mistake can be fixed. For an ace our server is preselected (and keeps a yellow outline).
110. The roster's "can't delete" explanation reads "appears in a played set (lineup, substitution or point details)".

### QA fixes (orchestrator)

111. **Header titles stay on one line** (`HeaderTitle`, set for every screen in `app/_layout.tsx`): long titles such as "vs <long opponent>" end in "…" instead of scrolling the page sideways; the title limits itself to the window width minus room for the back button. German link "Startaufstellung" → "Aufstellungen" (fits the 3 + 2 link row); the Print and Starters links' accessibility labels start with their visible text. "Delete all data" clears the export / import messages shown above it.

## v3.1

112. **"Show names instead of numbers"** (Settings → Player chips): a device setting like the language — `chipLabel: 'number' | 'name'` in the store (version 5; the v4 → v5 migration adds `'number'`, so nothing changes until it's switched on), kept on "Delete all data", not exported (export `schemaVersion` stays 4). With names on, every player chip (court, bench, libero, rotation viewer, live court) shows the last name (first name if there is none) in the circle — up to two lines at ≥ 11 px, kept inside the circle; long names may break mid-word or end in "…" on the smallest chips — and "#n" in the small label below; screen-reader labels and other texts ("We serve · #1", "L for #15") are unchanged.
113. **Version 3.1.0** (versionCode 30100).

## v4 — Roles on court

### Foundation (orchestrator)

114. **Roles are per-set overrides keyed by player id** (`SetLineup.roles`, `LineupPreset.roles`): a starter without an entry plays their primary position, so existing lineups need no data. Keying by player (not by court spot) makes roles follow players through swaps, drags and rotations for free; every edit prunes overrides of players who left the court (`pruneLiberoReplaces` now prunes both). Roles are locked in a played set like the starting six (`lineupLock`); the libero switch stays editable like `liberoReplaces` (#68).
115. **Off position = none of the player's positions** (primary or secondary, from the roster) — the owner's rule: a secondary position needs no confirmation and gets no "*". Choosing the primary position again removes the override.
116. **Substitutes inherit the role** of the player they replace (tracked by the live replay; `RallyStep.roles`, `LiveState.roles`).
117. **Rotation number = the setter's court position** (`setterRotation`): role S on court; with two setters the back-row one (lowest position first); null without a setter, and callers then fall back to counting rotations from the start (`LiveState.rotation`, unchanged).
118. **Libero on/off** (`liberoActive`, default on): off = no swaps anywhere; every swap reads `activeLiberoReplaces(set)`. "Libero replaces by role" sets `liberoReplaces` to the starters currently in those roles (`startersWithRoles`); substitutes for them aren't swapped (as #67).
119. **Data model v5**: export `schemaVersion` 5 (v1–v4 files upgraded with `roles: {}`, `liberoActive: true`; import rejects roles for anyone but the set's / preset's starters as `INCONSISTENT_REFERENCES`); store version 6 with the same defaults. `RoleTag` (`src/components`) draws the role and the "*" the same way on every court.
120. **Version 4.0.0** (versionCode 40000): major, because the store and export formats change again.

### Lineup builder (PR #34)

121. **Role tag above the chip** in its own ≥ 44 px button row (it doesn't overlap the chip); tapping it opens the role picker (S / OH / MB / OPP / DS). A listed position (primary or secondary) applies directly; an unlisted one asks "Play them as …?" (Cancel keeps the old role). While a player is selected for tap-to-select, tapping the tag places / swaps like the spot; a press that moved > 10 px (a drag) is ignored. Disabled in played sets.
122. **"\*" at the top right of the court spot** (`OffPositionMark`, shared by every court; `RoleTag` shows only the role), as the owner asked — only when the role is none of the player's listed positions.
123. **Rotate ↺ / ↻** under the builder court (disabled when played or empty). **Libero**: a "Libero plays" switch (shown when a libero is assigned; off greys out the replaces section) and role chips Middles / Outsides / Opposite / Setter / DS — a chip is "on" when the libero replaces all starters in that role, pressing it toggles that group; per-player chips and "Suggest middles" stay.
124. **Templates set roles** from the template's layout (override only where it differs from the primary, no confirmation, "*" if unlisted); after a fill the libero replaces the starters whose _role_ is MB. The lineup check's "unusual layout" warning judges roles, not primary positions.

### Rotation viewer and live mode (PR #36)

125. **The viewer counts rotations from the start internally and labels them by the setter's position**: stepper "Rotation 4 (setter on 4)" / "Rotation 4 (Zuspieler auf 4)", "Rotation n of 6" without a setter; the 1–6 jump row is sorted by that label; in a 6-2 the labels repeat and are told apart ("second time"). Starters cards show their setter rotation; the live scoreboard shows `setterRotation ?? rotation`.
126. **Role tags on every court** (rotation viewer, starters overview, team starters, live court — substitutes show the inherited role); the libero standing in shows "L" (never "*"). "Serving" / "L for #n" moved onto the chip's lower edge so the live court keeps its height (Substitution still fits at 390×844). A switched-off libero shows "Libero switched off for this set" instead of the swaps toggle. The next-set setup in live mode has Rotate ↺ / ↻ with "Setter on n".
127. Screen-reader role wording everywhere: "plays Setter[, not one of their positions]" / German gender-neutral "nicht als Position eingetragen".

### Stats and print (PR #35)

128. **Stats per rotation by the setter** (`setterRotation ?? rotation`, per rally; roles are fixed per set and substitutes inherit them, so a set is either all setter-numbered or all counted from the start). Row labels stay R1–R6; a note under the legend explains "R4 = setter at position 4" and the fallback.
129. **Print sheet**: each spot's role code right-aligned on its position line ("*" when unlisted, one explanatory note per sheet), "Libero off" instead of "Libero replaces" when switched off. The results block is one compact line and court-cell names stay on one line, so 5 sets + 12 players fit one A4 page with or without results, also with long names (checked EN + DE).
