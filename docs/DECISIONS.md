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

### QA fixes (orchestrator)

130. **The libero replaces a role, so substitutes count** (amends #67 / #118): in live play a substitute for a player the libero replaces takes their place in whom the libero replaces (they inherit the role), and the starter coming back takes it again. Tracked by the replay (`RallyStep.liberoReplaces`, `LiveState.liberoReplaces`); live court, stats and the point-tag player list use it. The owner asked to choose which _position_ the libero substitutes.
131. **Deleting a player also removes their role overrides from presets / team starters** (exports stay importable); copying a preset keeps roles and the libero switch; "Suggest middles" goes by role (players playing MB); imported role overrides must be court roles (S, OH, MB, OPP, DS — not "L"); rotate buttons are ↺ / ↻ in that order everywhere; the stepper keeps "on 4" together with a no-break space. The libero switch stays editable in played sets (like #68): it changes how past rallies are shown and counted.

## v5 — Formations

### Foundation (orchestrator)

132. **Roles belong to the court spots, not to players** (replaces #114–117's per-player overrides): a set / preset has a `formation` (system 5-1 or 6-2, order 'outside' or 'middle', `setterAt`) that fixes every spot's role so the pairs 1–4, 2–5, 3–6 always match (S–OPP or S–S, OH–OH, MB–MB). Owner's choice: only 5-1 and 6-2, and the formation is fixed (no editing single spots). Default: 5-1, setter followed by an outside, setter spot at 1. Patterns and sources: `docs/VOLLEYBALL_RULES.md` §2.
133. **Rotating before the set turns the formation with the players** (`setterAt` moves like a player), so everyone keeps their role; in live play players carry their starting role and substitutes inherit it (#116 unchanged). The formation is locked in played sets like the starting six.
134. **Off position** = the spot's role is none of the player's listed positions (#115 unchanged); placing such a player asks for confirmation and the spot shows "*".
135. **Data model v6**: export `schemaVersion` 6, store version 7. v5 data / files: the per-player roles become the formation that matches where the setter stands (`inferFormation`: first starter playing S → `setterAt`; a second setter opposite → 6-2; a middle right after the setter → 'middle' order; no setter → default). v4 → v5 still adds `roles: {}` first, so older files go through the same inference.
136. **Templates** fill players into the set's formation by spot role (6-2 hitter spots also accept an opposite); choosing 5-1 / 6-2 sets the system and keeps order and setter spot. The lineup check no longer raises "unusual layout" (the formation can't be unusual); "no setter" means no listed setter on the setter spot(s).
137. **`docs/VOLLEYBALL_RULES.md`** is the rules reference for the app: rules with sources (FIVB 2025–2028, DVV) and a numbered list of checks with PASS / FAIL / NOT MODELLED; keep it updated when the app changes. Note: the sandbox couldn't open the FIVB PDF itself, so rule sub-numbers follow the usual numbering (caveat in the file).
138. **Version 5.0.0** (versionCode 50000).

### Lineup builder (PR #40)

139. **Formation controls** in one compact row above the court: system 5-1 / 6-2 and order "S → Outside" / "S → Middle" (long form in the accessibility label and a caption with the role order). Every spot shows its role, empty spots too; locked in played sets.
140. **"Are you sure?" covers every way a player can end up on an unlisted role**: drag & drop, tap-to-select (bench → court and swaps; one dialog for both players) and formation changes (system / order, in the builder and the live next-set setup). It only asks about players whose role actually changes to an unlisted one, so rotating never asks; Cancel changes nothing and keeps a tap-to-select selection. Template fills, presets and copies never ask (the "*" still shows).
141. **Rotating works on an empty court** (builder and live setup): it turns the formation, so the setter's starting spot can be chosen before placing anyone; "Setter on n" sits between the rotate buttons.
142. **The libero follows the middles on a formation change** only when it replaced exactly the old middles (`changeFormation`); any other choice, including nobody, is kept. Pure modules `placementCheck.ts` (who ends up off position) and `formationChange.ts`.

### Other courts and rules (PR #41)

143. **Every court shows the formation's roles on all spots**, also empty ones: rotation viewer (the formation turns with each step: `formationSteps.ts`), starters overview, team starters, print sheet. The viewer always names rotations by the setter spot (`formationRotation`), so incomplete courts are named too; the old "Rotation n of 6" fallback and `rotationNames.ts` were removed. An empty spot's screen-reader text names its role.
144. **Point tags offer only plausible players** (rules doc check #35): block = front-row players (2–4) on court during that rally, never the libero; ace = our server of that rally; kill = anyone on court except the libero (back-row attacks are legal); our error = anyone on court. A player already tagged with a kind stays listed so the tag can be cleared.
145. **`docs/VOLLEYBALL_RULES.md` §6** lists checks 1–62 with PASS / NOT MODELLED and no FAIL on v5.0; formation checks are #53–62.

### QA fixes (orchestrator)

146. **"Clear" keeps the formation and the libero switch** (only players leave); **6-2 → 5-1 keeps the back-row setter spot** (the one the rotation is named after), so the setter never jumps to the front row. Migrated v4 data keeps the setter spot; other old per-player roles that don't fit the pattern now show "_" (e.g. two adjacent outsides become OH + MB_) — the coach fixes them by moving players. The stats legend no longer mentions the "count from the start" fallback (a formation always has a setter spot).

## v6 — Players & performance

### Foundation (orchestrator)

147. **Data model v7** (app 6.0): profiles and players may have a `photoId`, players a confidential `description` (trimmed, 1–1000 characters), and an "our error" tag an `errorType`. All optional, so old data stays valid as it is. Store version 8 (the v7 → v8 step changes nothing). Export `schemaVersion` 7 with a `photos` list; v1–v6 files are upgraded with `photos: []`. Import rejects a profile or player whose photo isn't in the file, duplicate photo ids, an error type on any kind but "our error" (`INCONSISTENT_REFERENCES`), and non-image data URIs, photos over 200 000 characters, and blank or untrimmed descriptions (`INVALID_SHAPE`). Photos nobody refers to are dropped.
148. **Photos live outside the main store**: one storage key per photo (`volley-lineup-photo:<id>`, `src/store/photoStore.ts`) holding a data URI (≤ 256 px, JPEG quality 0.7, about 10–30 KB). The main store is written on every rally in live mode, so it stays small, and no single stored value grows with the number of photos (Android AsyncStorage has a per-value limit). Data URIs work the same on web and native, and in export files. Photos nobody refers to are deleted automatically when profiles or players change. So save a photo before pointing a profile or player at it, and keep an unsaved form's picture in local state. Screens show the fallback until photos have loaded; export and import wait for them.
149. **Photos are always exported** (owner's choice). Export a team and the photos of that team's profile and players go with it.
150. **Descriptions are exported only when chosen** (owner's choice): Export offers "Include descriptions" only while descriptions are unlocked, off by default (`buildExport({ includeDescriptions })`). **A merge never deletes a picture or description**: an incoming profile or player without a `photoId` or description keeps the existing one; when the file has one, the file wins. Replace takes the file as it is.
151. **Error types** (owner chose the 7-type list): Serve · Reception · Attack · Block · Set · Net / foul · Other. "Net / foul" covers the referee's faults that aren't a skill error (net touch, centre line, rotational / positional fault, double contact / catch, four hits). No type = "unspecified", shown as such in the stats. Plausibility (rules doc §7): a serve error only on our serve and only by our server; a reception error only when they served; a block error only by a front-row player who isn't the libero; an attack error by anyone on court but the libero. `setLastErrorType` also turns an untagged lost rally into "our error"; re-tagging "our error" (e.g. to pick the player) keeps the type.
152. **Performance numbers** (`src/domain/performance.ts`, on top of `stats.ts`, same counted sets and #94–97 rules): _rallies on court_ = rallies the player stood on court for, with that moment's libero swap applied. So the libero counts the rallies they played, and a middle replaced in the back row doesn't count those. _Plus/minus_ = rallies won − lost while on court. _Net points_ = kills + aces + blocks − errors. _Rating_ = the sign of net points when the player has any tagged action, otherwise the sign of plus/minus (positive / even / negative; none without rallies). _Error rate_ = errors ÷ rallies on court; _errors per action_ = errors ÷ (K + A + B + E); _serve error rate_ = serve errors ÷ serves; _attack error rate_ = attack errors ÷ (kills + attack errors); each "–" when its divisor is 0. Performance rows sort by most rallies on court first, then by jersey number.
153. **Routes**: player detail `/team/[teamId]/players/[playerId]` (back → roster); performance `/match/[matchId]/performance?set=N|all&player=ID` (back → match). A match in the player detail's list opens that match's performance view for the player (All sets).
154. **New dependencies** (Expo SDK 58 versions via `EXPO_OFFLINE=1 npx expo install`): `expo-image-picker` (camera and gallery, with the permission texts in `app.json`), `expo-image-manipulator` (resize and compress to 256 px JPEG on the device), `expo-local-authentication` (biometrics or device PIN to unlock descriptions, with the Face ID text in `app.json`). They are installed in the foundation so parallel workers don't both edit `package.json`.
155. **Version 6.0.0** (versionCode 60000): major, because the store and export formats change.

### Player detail and descriptions (PR #46)

156. **Player detail screen**: a roster row tap opens it, and Edit opens the existing form. The header title is the player's name. Season stats are shown as compact tiles, with the match list newest first (same order as the Matches tab). Tapping a match opens its performance view for that player. Errors by type read "2 × reception error". Deleting a player always lands on the roster; if the player disappears while the detail screen is open, it replaces itself with the roster.
157. **Unlocking descriptions**: on a phone with a device lock (biometrics or at least a PIN, `getEnrolledLevelAsync() !== NONE`), the system prompt with PIN fallback is used. Without one, if the check fails, and always on web, an in-app "These notes are confidential. Show them?" confirmation is used. A cancelled or failed prompt stays locked, and so does one that succeeds after the app has left the foreground.
158. **Auto-lock**: one app-wide `AppState` listener. `background` always locks, and so does a hidden tab on web. `inactive` locks too, except while our own unlock prompt is open (iOS Face ID makes the app inactive). The unlock state and the "Include descriptions" tick live in one in-memory store (never persisted), so locking or restarting clears both. An unsaved description draft is discarded on lock (confidentiality first). Unlocking is also offered in Settings → Export, next to the checkbox. The import preview shows only the number of descriptions in a file.

### Performance and error types (PR #45)

159. **Error-type chips**: after "Our error", the plausible types appear in a labelled group above the player chips. A chosen type collapses to its own chip, and tapping it again clears it. Our error → player is still one tap. **The tagged player always fits the type** (`errorTagging.ts` `chooseLastErrorType`): a serve error names our server, or replaces an implausible player with the server; any other implausible player is dropped. The undo label reads "· our error (serve) #7 Smith".
160. **Performance view**: the match screen has a 6th link, "Performance" (phones: two rows of three links). It opens the selected set if that set was played, otherwise All sets. Each card shows the photo or number, rallies, won–lost (±), K · A · B · E · Net, and the rating as a symbol plus a word (▲ Positive / ● Even / ▼ Negative / – No rallies; never colour only). Rates are whole percentages, each with a one-line explanation; "–" without a divisor. Plural error names live in `performance.ts`. Opening a player pushes a history entry, so the hardware or browser back returns to the overview. Switching to a set the player didn't play shows the overview.

### Photos (PR #47)

161. **Picking a photo** (`src/lib/pickPhoto*.ts`, `src/domain/photoCrop.ts`): the picture is cropped to its centre square, scaled to at most 256 px (never up) and saved as a JPEG at 0.7 as a base64 data URI (about 5–15 KB). Phones ask for camera access first and offer the system's square crop. On web, "Take photo" is offered only on touch screens (a file input with `capture`); desktop opens the file chooser directly. Cancel, a refused permission and a failure each show a message and never crash. The camera / gallery choice is shown inline in the form, not in a modal (on iOS a system picker can't open while a modal is closing).
162. **Saving a photo**: the picked picture stays in the form until Save. Save and Create profile are disabled while a picture is being prepared ("Preparing photo…"). On save, `setPhoto` updates memory first and the profile or player is pointed at the new id on the next line, without awaiting the storage write. That leaves no window in which the orphan prune could delete the new photo (amends the "await first" wording of #148). A changed photo gets a new id; Remove saves without a `photoId`.
163. **Where photos show**:

- profile: picker rows, teams header, Profile tab card, form
- roster rows: the photo with a small number badge; inactive players' photos are dimmed
- player form and player detail
- lineup bench and live substitution bench: the photo, with "#7 Name" below
- court chips keep the number or name and never show a photo (clearer at 375 px)

"Delete all data" mentions photos. The profile list button reads "Edit profile X" (DE "Bearbeiten: Profil X"), because it also edits the photo.

### QA fixes (orchestrator)

164. **The point-tag player picker is one line that scrolls sideways** (✕ stays visible on the right). With "Our error" open, the types and players used to wrap onto 3–6 rows, which pushed the court's back row and the Substitution button off the 390×844 screen (#75, #126). Now the row is 44 px like the kinds row: the chosen kind first, then the error types, then the players. Checked at 390×844 and 375×812, EN + DE.
165. **No dangling photo ids**: if a photo's storage write fails (e.g. storage full), `setPhoto` drops the photo again and `prunePhotos` clears every `photoId` whose photo is missing, so the player or profile falls back to the number or avatar. `buildExport` also leaves out such ids, so an export always imports. Not done: a message in the form when this happens (the form has already closed).
166. **Performance view**: switching to a set the open player didn't play shows the overview and drops `player` from the URL, so switching back doesn't reopen them.

## v6.1

167. **Performance inside live mode** (owner request): live mode has a **Performance** button at the top right of the header. It switches to the performance overview for the set being played (All sets until that set has a rally; other sets selectable), where tapping a player opens their detail; the button then reads **Live** and switches back to the court. It's a header button, not a tab row, so the live screen keeps its height (court + Substitution still fit at 390×844, #164). The choice and the selected set / player are local state: the URL and history don't change, the score and tagging aren't affected, and switching back keeps everything as it was. Tapping a court player still opens the substitution flow. Version **6.1.0** (versionCode 60100); no data model change.

## v6.2

168. **Performance list: best first, worst last** (owner request; replaces "most rallies first" in #152 / #160): rows are ordered by the rating badge (▲ Positive → ● Even → ▼ Negative → – No rallies, so the badges never interleave), then net points, plus/minus and rallies on court (higher first), then jersey number (`compareByPerformance`). Applies to the performance view and the live Performance view.
169. **Match search** (owner request): a "Search matches" field above the team's match list (shown once there is a match) filters by opponent or date. Every word must match the opponent (case- and accent-insensitive, anywhere in the name) or the date: part of the stored `YYYY-MM-DD` ("2026-11", "11-21"), German "21.11." / "21.11.2026" / "21.11.26" or US "11/21" / "11/21/2026" (`src/domain/matchSearch.ts`). A count ("1 of 2 matches") or "No matches for …" is shown while searching; the query isn't saved.
170. **Partly filled team starters** (owner request: "maybe only 3 are starters and the rest are picked before the game"): team starters are used as soon as they have anyone in them (a court player or the libero; `hasAnyPlayer`), not only when all six spots are set. A new match's set 1 is pre-filled with them and the empty spots stay empty; the live next-set setup offers them too. The rest is picked in the lineup builder before the game; live play still needs all six (unchanged). The Starters tab says "3 of 6 positions set. New matches start with them in set 1; pick the other players in the match before the game." (no longer shown as a warning). Version **6.2.0** (versionCode 60200); no data model change.

## v7 — Seasons & tournaments

### Foundation (orchestrator)

171. **Seasons are their own collection** (owner's choices: every match belongs to a season; opponents picked from the season's list or added by typing; the season screen shows stats, a record per opponent, and dates / place). `Season { id, teamId, name, kind: 'season' | 'tournament', startDate?, endDate?, location?, createdAt }`. `Opponent { id, seasonId, name }` is scoped to a season, so the same club in two seasons is two opponents, which keeps each season self-contained. Every `Match` has a `seasonId` and an `opponentId`. It keeps `opponent` (the name) because many screens show it; renaming an opponent renames its matches. The team's old free-text `season` field stays and is used to name the upgraded season.
172. **Data model v8**: export `schemaVersion` 8, store version 9. Old data / files: `upgradeToSeasons` gives every team one season (`season-<teamId>`, named after the team's season text, else the years of its matches ("2025–2026"), else the year the team was created). Every distinct opponent name (compared ignoring case, accents and extra spaces; first spelling kept) becomes an opponent `opp-<seasonId>-<folded name>`; each match keeps its own opponent text. The ids are deterministic, so the same old file imported or merged on two devices gives the same seasons. Import rejects a season of an unknown team, an opponent of an unknown season, or a match outside its own team's season or against another season's opponent.
173. **Names**: a season name is required, ≤ 40 characters and unique within the team; an opponent name is ≤ 60 and unique within the season. Both are compared ignoring case and accents. Dates are optional ISO dates with the end not before the start; the place is ≤ 80 characters. Deleting a season deletes its opponents and matches (the UI asks first); an opponent can only be deleted while it has no matches. Seasons are listed newest first (start date, else creation date).
174. **Record per opponent** (`opponentRecords`): played = matches with at least one rally, split into won / lost / in progress; upcoming = not started; sets won : lost. Every opponent of the season is listed (also without matches), by name.
175. **Version 7.0.0** (versionCode 70000): major, because the store and export formats change.

### Seasons UI (PR #55)

176. **Season boxes**: the team's Matches tab (label and `tab=matches` unchanged) lists the seasons as cards, newest first, two per row on wide screens. Each card shows the name, a kind badge (Season orange / Tournament blue edge and badge), dates ("from …", "until …", "… – …") and place, and "n matches · W–L" once a match has been played. The season screen (`/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats`) shows the name, kind, dates and place, with Edit, and tabs Matches (the old match list + v6.2 search + New match) · Opponents · Stats (season overview, rotation and player tables of that season only). The header title is the team name.
177. **Opponents tab**: each row shows the record ("1–1 · 3 played · 1 in progress · 1 upcoming · sets 4:3"), with inline Add and Rename. Delete is hidden while the opponent has matches (one hint line explains why) and asks first otherwise. Tapping an opponent shows only their matches. That filter is screen state with a "vs X ✕" button, not a URL parameter, because upgraded opponent ids contain "%" and the router decoded them twice. Back navigation: match → its season → the team's Matches tab (`parentRoute` with `seasonIdOfMatch`).

### New match and stats (PR #54)

178. **New match in a season**: opened from a season (`?seasonId=`), the form names that season. Without one it offers the team's seasons as chips (newest preselected); if the team has none, a "Season name" field prefilled with the year creates one. The opponent is a chip of the season's opponents or a typed name. A typed name equal to an existing one (ignoring case and accents) selects it ("TSV München is already in this season"); a new one is added ("X is added to …"). Saving re-reads the store, so two quick presses don't create two seasons or opponents. Validation: `src/domain/matchForm.ts`.
179. **Stats tab season switcher** (shown once a team has two or more seasons): All seasons · each season, newest first. It opens on the newest season with a played match, else All seasons (`src/domain/statsSeason.ts`). The overview heading is the selected season's name or "All seasons". The match screen shows "2026/27 · Season" under the result, and each player-detail match line includes the season.

### QA fixes (orchestrator)

180. **One spelling per opponent** (amends #172): the upgrade now gives every old match its opponent's name (the first spelling, trimmed, inner spaces collapsed, ≤ 60 characters, "?" when empty). Old "tsv munchen" matches therefore show "TSV München", like the opponent list.
181. **No duplicate names from an import**: season names must be unique within a team and opponent names within a season, also in files (`INCONSISTENT_REFERENCES` otherwise). A merge first matches an incoming season or opponent to an existing one with the same name (`alignIncomingByName`) and moves its matches over, so two devices that both created "Rivals" or "2026/27" end up with one.
182. **Wording**:

- The player detail's stats heading is "All seasons" (it adds up every season).
- "New season / tournament", "Edit season / tournament".
- The import preview counts seasons; "Delete all data" mentions seasons.
- Match row labels start with the visible text ("vs X, date: open the match"; DE "Löschen: Spiel gegen X").

183. **The team's old free-text season is no longer shown or edited** (team header, team list, team form). An existing value stays in the data; it named the upgraded season.

## v8 — Look & feel

### Foundation (orchestrator)

184. **Theme setting: Dark / Light / System, default Dark** (owner's choice). Existing users keep today's look after the store v9 → v10 upgrade. "System" follows the device (`useColorScheme`) and falls back to dark when the device says nothing; `app.json` `userInterfaceStyle` is now `automatic` so the native side reports it.
185. **Dyslexia font: OpenDyslexic** (SIL Open Font License, free to bundle). Dyslexie is commercial and the owner had no files or licence; the font files can be swapped later behind the same family names (`src/theme/fonts.ts`).
186. **Theme pattern**: `ThemeProvider` (props `mode`, `dyslexiaFont`; wired from the store in `app/_layout.tsx`, so `src/theme` doesn't import the store), `useTheme()` and `makeStyles((theme) => ({…}))` at module level returning a `useStyles()` hook. Styles are built once per theme (four themes, cached). The static `colors` / `positionColors` exports stay as deprecated aliases of the dark palette until the theme-conversion PR removes their last uses.
187. **The dyslexia font goes in through the styles**: `makeStyles` gives every style with `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` the font family; weights ≥ 600 use the bold family and drop `fontWeight` (custom fonts carry the weight in the family). A style with its own `fontFamily` is left alone.
188. **New colour tokens**: `primaryText` (orange for text / icons on the background — the plain orange fails AA on white, so light mode uses a dark orange `#A84300`) and `onCourt`. Light palette: white background, `#F3F3F3` / `#E8E8E8` surfaces, `#111` text, `#555` muted text; the libero badge becomes light grey. AA for all text tokens on all three backgrounds and for the badges is a unit test (`src/theme/theme.test.ts`).
189. **Date input**: `parseDateInput` accepts `d.m.yy`, `dd.mm.yy`, `d.m.yyyy`, `dd.mm.yyyy` and ISO (`YYYY-MM-DD`), with spaces around it; no other separators. Invalid calendar days (31.02.) are rejected. `validateNewMatch` and `validateSeasonForm` parse with it and store ISO. `formatDate` returns an unparseable stored value unchanged so it stays visible.
190. **Short player names**: the first name; the last name's initial with a dot when a teammate has the same first name (compared ignoring case, accents and spaces); the whole last name when the initials clash too; the last name when there is no first name. Computed per team (`shortNames`), never stored.
191. **Team pictures are merged like player pictures** (#150): an incoming team without a `photoId` keeps the existing team's picture; a picture in the file wins. A team export carries only that team's picture.
192. **App icon colours**: the owner's black ball on the app orange `#FF6B00` (owner's choice) for the icon, adaptive icon background and splash; the monochrome icon is the ball's shape.
