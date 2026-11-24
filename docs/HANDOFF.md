# Handoff — start here in a new chat

This file lets a fresh Claude session continue Volley Lineup where the last one stopped.
**Run `/start` in a new chat** (it reads this file and the right docs).
**Run `/wrap-up` before you close a chat** (it updates this file).

Last updated: 2026-11-24, after releasing **v9.0.0**.

---

## 1. Where we are

| Version | What it added                                                                                                                                                                                                                              | Release  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| v1.0.0  | Profiles, teams, roster, matches, lineup builder (drag & drop + tap), rotation viewer, starters overview, export/import, persistence                                                                                                       | `v1.0.0` |
| v2.0.0  | Libero swaps, 5-1/6-2 templates, live match mode, substitutions, lineup lock, print/PDF, German                                                                                                                                            | `v2.0.0` |
| v2.1.0  | Phone lineup layout (bench under the court), app tab bar (Teams · Profile · Settings), Profile tab with log out                                                                                                                            | `v2.1.0` |
| v2.2.0  | Team nav bar (Roster · Matches · Presets · Starters), saved lineup presets, team starters (pre-fill new matches), data model v3                                                                                                            | `v2.2.0` |
| v3.0.0  | Whole-match live mode (set score, next-set setup, match summary, undo across sets), Stats tab + match stats, optional point tagging, print with results, data model v4                                                                     | `v3.0.0` |
| v3.1.0  | Settings → "Show names instead of numbers" on player chips (store v5)                                                                                                                                                                      | `v3.1.0` |
| v4.0.0  | Roles on court (tag + picker with confirmation, "*" for unlisted roles), rotate before the set, rotation named after the setter, libero by role + on/off, data model v5                                                                    | `v4.0.0` |
| v5.0.0  | Formations: roles belong to the court spots (5-1 / 6-2, setter → outside / middle), roles on empty spots, confirmation for off-position placements and formation changes, volleyball rules doc, plausible point-tag players, data model v6 | `v5.0.0` |
| v6.0.0  | Players & performance: profile / player photos, player detail screen with season + per-match stats, confidential descriptions (biometric / PIN unlock), performance view per set / match, error types on "our error", data model v7        | `v6.0.0` |
| v6.1.0  | Performance inside live mode: header button Performance / Live (overview of every player for the current set or all sets, player detail)                                                                                                   | `v6.1.0` |
| v6.2.0  | Performance list best → worst, match search by opponent / date, partly filled team starters                                                                                                                                                | `v6.2.0` |
| v7.0.0  | Seasons & tournaments: season boxes, season screen (matches · opponents with records · stats), opponent picker for new matches, Stats season switcher, data model v8                                                                       | `v7.0.0` |
| v8.0.0  | Look & feel: light / dark / system theme, dyslexia font (OpenDyslexic), Swiss dates dd.mm.yy, roster player cards, first name first, team pictures, tab slides + swipe, rotation slides, new app icon; store v10, export v9                | `v8.0.0` |
| v8.1.0  | Interactive drag between tabs: the page follows the finger with the neighbouring tab beside it (RNGH + Reanimated pager)                                                                                                                   | `v8.1.0` |
| v8.1.1  | Swipe without flicker: real pager (neighbour tabs stay mounted, no swap on release), app tab bar moves the real scenes                                                                                                                     | `v8.1.1` |
| v8.2.0  | Roster cards show the player's picture in full (square, card width) with the text below                                                                                                                                                    | `v8.2.0` |
| v8.3.0  | Code health (no visible change): audit (`docs/AUDIT.md`), cached derived data, split domain files, shared UI kit, accessible names start with the visible text, export golden + screenshot harness, faster CI                              | `v8.3.0` |
| v8.4.0  | Owner polish: faded player photo behind the number on court chips, room under the team tabs' add buttons, Settings switch renamed "Prioritise names"                                                                                       | `v8.4.0` |
| v9.0.0  | Guided tour: Full / Quick / No tour on first start, tip popups with a small visual guide, quick-tour offers on other screens, Profile → Tutorial; store v11                                                                                | `v9.0.0` |

- `main` is green (CI), **1503 tests** (120 suites), `src/domain` at 100% coverage.
- Current versions: app **9.0.0** (`app.json` + `package.json`, must match), store **11**, export `schemaVersion` **9** (device settings `language`, `chipLabel`, `themeMode`, `dyslexiaFont`, `tourMode`, `tourSeen` aren't exported; photos live outside the store but are exported, incl. team photos).
- Last decision number in `docs/DECISIONS.md`: **#246**. Continue at #247.
- Releases: https://github.com/Nick-ze/volley-lineup/releases (APK per version).

### Open items / known gaps

- **v9.0 tour not verified on a real phone**: popups, `useFocusEffect` with the native stack / app tab pager, Android back on the choice dialog (can't be dismissed on first start by design). Checked on web (Playwright, touch + mouse, 375 / 1280, EN + DE, dark + light, font) and in Jest.

- **v8.3 (code health)**: QA found no visible or stored difference vs 8.2.0 (only screen-reader labels changed). Not verified on a phone: the `tabMotion` split into `pagerLayout` / `slideMotion` / `tabDrag` (same 8 worklets), Reanimated / RNGH on device. Found and left for later (AUDIT "Results"): the store rewrites its whole JSON on every rally (~1 MB per 60-match season — AsyncStorage limits after a few seasons); the pager / `NoTabSwipe` gesture callbacks aren't worklets (JS thread on native, same as 8.2, #229 — check on a device); 3 replays per point (different `players` arrays); on web `/` still loads the Settings chunk (zod) at start; hidden season `MatchRow`s re-render on each point; the `TabPager` holdSettle test is weak; open question whether `PlayerChip` labels should start with the number.

- **v8 / v8.1 not verified on a real phone**: animation feel and the interactive tab drag (the owner saw a flicker on every swipe in 8.1.0 — fixed in 8.1.1 by a real pager, #218–220; 8.1.1 is not yet confirmed on the phone; Live keeps Performance mounted beside it — if scoring feels slow on a phone, mount it on idle), OpenDyslexic rendering and fit on Android, the launcher icon (adaptive + monochrome) and splash, store v9 → v10 upgrade in Android AsyncStorage, "System" theme following the phone. All checked in a browser (Playwright, mouse + touch emulation, 375 / 390 / 1280, EN + DE, dark + light, font on) and by unit tests.
- v8 known gaps (not fixed): next-set setup has no court, so its Rotate doesn't slide (#207); reduce motion is read at app start only (#208); nested tab sets only slide, the outermost swipes (#204); the sliding rotation copies repeat the spots' test IDs for ~290 ms; the native root background (`app.json` `backgroundColor`) stays dark in light mode (#196); the court's white outer border is invisible on the white page; long single-word first names wrap mid-word in small court chips; long names are cut with "…" on performance cards with the font on; the season screen header doesn't show the team picture; with a mouse on web, dragging from a tag chip and releasing counts as a tap; a very long opponent name can push the live Substitution button ~20 px below 844; the icon's ball panels are orange because the source PNG's panels are transparent (#193 — ask the owner if they want white panels).

- **v6 not verified on a real phone**: the camera and photo-library permission prompts (`expo-image-picker`), biometric / device-PIN unlock (`expo-local-authentication`, incl. whether iOS Face ID's `inactive` event interferes — DECISIONS #158), auto-lock when the app goes to the background, the store v7 → v8 upgrade in Android AsyncStorage. All checked in a browser (Playwright) and by unit tests with mocks only.
- v6 known gaps (from QA, not fixed): no message in the form when a photo can't be stored (storage full; the reference is rolled back, #165); a Replace import of a file exported without descriptions removes existing descriptions (by design, #150 — maybe warn in the preview); the player detail match line shows no score while set 1 is still running. (The old accessibility labels were fixed in v8.3, #235.)
- Never verified on a real phone: v2.x / v3.0 APKs (incl. the store v3 → v4 upgrade in Android AsyncStorage, the live screen with tag row on a device, safe areas), native touch drag & drop, the phone PDF (`expo-print`). v3 was checked in a browser only (Playwright, 390×844 / 375 / 1280, EN + DE).
- GitHub Pages (web version) is not enabled — the repo is private; the owner must enable Pages (Settings → Pages → Source: GitHub Actions) or make the repo public. The deploy workflow skips with a warning until then.
- The Android emulator smoke test (`android-smoke.yml`) is manual-only and flaky on hosted runners.
- Small known nits (not bugs): at 320 px (below the 375 px target) the German "Aufstellungen" / "Rückgängig" labels clip a few px inside their buttons; react-native-web's `Modal` plus the print choice card give two nested `role="dialog"` elements.
- Remote branch `docs/v3` is merged content (via #29) but couldn't be deleted (git proxy refuses branch deletes) — safe to delete from GitHub.

### Ideas for next versions (from the owner's requests and the plan)

- Possible follow-ups from the v3.1 review: show short names instead of numbers in "We serve · #1" and "L for #4" when names are on; a quick names/numbers switch on the court screens (now only in Settings).
- v4 ideas not built: drag-free role editing in live mode (roles are locked once a set is played; reset live data to change them), a one-line rotation stepper title at 375 px (wraps to two lines), libero-off marker on the libero slot itself.
- v5 notes: migrated v4 lineups keep the setter spot; other old per-player roles that don't fit the pattern show "*" until the coach moves players. Not modelled (see VOLLEYBALL_RULES §6): overlap faults, 4-2 / 6-6 systems, second libero, libero-in-one-set-player-in-another, time-outs, changing ends, best-of-3 formats.
- Stats ideas not built: per-rotation totals row, charts/trends over the season, CSV export of stats, opponent-side stats.
- Tagging: more kinds (e.g. dig / serve error), tags for points before v3 can't be added afterwards (only the last rally is taggable).
- v6 follow-ups: a 2-column performance grid on wide screens; photos on the print sheet or court chips (deliberately left out, #163); a "dig / defence" error type (owner chose 7 types, it's "Other" now); per-error-type columns in the Stats tab; a storage-full message for photos.
- v8 follow-ups: next-set setup mini court (so its rotate slides), live reduce-motion updates, swipe for nested set filters, `SystemUI.setBackgroundColorAsync` per theme, white-panel icon variant if the owner wants it, dyslexia font size setting (now 0.85×, #200).
- v7 follow-ups (QA nits, not done): a new match's date defaults to today even inside a dated tournament; matches on the same date list oldest-created first; the new-match form's season chooser / "new season in the form" paths are only reachable without `?seasonId` (no UI link does that now); performance / player detail have no season filter (player detail sums all seasons).
- Cloud sync / real accounts (explicitly out of scope so far — needs a backend; see DECISIONS #55).
- Whatever the owner asks for next — ask them if the request is ambiguous (e.g. "presets" was interpreted in DECISIONS #80–85).

---

## 2. Read these (in this order)

1. `CLAUDE.md` — binding rules (code, tests, git, agents).
2. `docs/HANDOFF.md` — this file.
3. `docs/PLAN.md` — features and data model (§1–10 v1, §11–13 v2, §14 v2.2, §15–17 v3, §18 v3.1, §19–21 v4, §22–24 v5, §25–27 v6, §28–30 v7, §31–33 v8, §34–35 v8.3). PLAN §36–37 v8.4, §38–39 v9.0. `docs/AUDIT.md` — the v8.3 code audit (ranked findings, results, what was skipped).
4. `docs/DECISIONS.md` — every choice made so far (#1–236). Skim headings; read the ones touching your task.
5. `docs/WORKER_BRIEF.md` — the brief given to worker agents (conventions, testing notes). Rewritten in v8.3 (conventions, tests, proof of no change).
6. `docs/VOLLEYBALL_RULES.md` — the volleyball rules that matter for the app (FIVB / DVV, with sources) and a numbered list of checks (PASS / NOT MODELLED). **Check new features against it and keep it updated.**
7. `docs/README_LEGACY.md` — version history (what every version added), export / import details, release steps, development guide. `README.md` is the short guide for app users (install, Expo Go, backup).

---

## 3. Architecture in one screen

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 strict, Expo Router, Zustand v5 + AsyncStorage, zod, RNGH v3 + Reanimated 4, Jest (jest-expo) + RNTL v14.
- **Routes** (`app/`): `/` profile picker · `(tabs)` group with `/teams`, `/profile`, `/settings` (bottom app tab bar) · `/team/[teamId]?tab=roster|matches|presets|starters|stats` (team nav bar, a component in `src/features/team/`) · `/team/[teamId]/players/[playerId]` (v6 player detail; a roster tap opens it, Edit → the form) · `/team/[teamId]/player` (modal editor) · `/match/[matchId]/performance?set=N|all&player=ID` (v6) · `/team/[teamId]/match-new` (modal) · `/team/[teamId]/preset/[presetId]` · `/team/[teamId]/starters` · `/match/[matchId]?set=N` (lineup builder) · `/match/[matchId]/rotation|starters|live|stats` (live without `?set` opens the current set / summary) · `+not-found`. Header titles go through `HeaderTitle` (one line, truncates) set in `app/_layout.tsx`.
- **Domain** (`src/domain/`, pure, 100% tested): `types.ts` (single source of types), `rotation`, `lineupValidation`, `lineupEditing`, `lineupLock`, `liberoSwap`, `templates`, `liveSet` (replay of the event log; `replaySteps` gives the state before each event), `matchState` (set/match results, current set, duration — derived, never stored), `matchFlow` (next-set setup, serve default, undo across sets), `stats` (rotation / player / season stats incl. tag totals), `pointTags` (tag kinds and validity, `tagLastPoint`), `lastRally` (who was on court during the last rally, plausible tag kinds), `roles` (role overrides, off-position rule, rotate, setter rotation, libero by role), `liberoRoles`, `rotationNames` (viewer labels by setter), `presets`, `playerUsage`, `roster`, `exportSchema` (barrel over `exportFormat` zod schema / `exportUpgrades` v1–v8 → v9 / `exportConsistency` / `exportMerge`), `lineupSheet` (print HTML; `lineupSheetCss`, `lineupSheetResults`). v8.3: `memo.ts` (`memoByIdentity` / `memoByIdentity2`, WeakMap caches — `getMatchState`, `setResult`, `countedSets`, `setStats`, `setPerformance` and the replay return cached, **read-only** results; never mutate them), `liveSet` split into `setScore` / `subRules` / `liveCourt`, `seasons` barrel over `seasonNames` / `seasonUpgrade` / `seasonForms` / `seasonRecords` / `seasonMerge`, `legacyData.ts`, `duration.ts`. Sub-modules never import their own barrel.
- **Data model v4**: point events `{ type: 'point', winner, kind?, playerId?, at? }` (tags + ISO timestamp); subs unchanged. Nothing about results is stored.
- **Data model v6** (app 5.0): sets and presets have a `formation` (`{ system: '5-1'|'6-2', order: 'outside'|'middle', setterAt }`, `src/domain/roles.ts`) that fixes every court spot's role (pairs 1–4, 2–5, 3–6 always match; locked in played sets) and `liberoActive`. Players play their spot's role; rotating turns the formation with them; placements / formation changes onto unlisted roles ask first (`placementCheck.ts`, `formationChange.ts`). The live replay tracks roles (substitutes inherit), the setter rotation and whom the libero currently replaces (`RallyStep` / `LiveState`). Every libero swap goes through those (or `activeLiberoReplaces` outside live play). Courts draw roles with `RoleTag` and the "*" with `OffPositionMark` (top right of the spot).
- **Data model v7** (app 6.0): `photoId?` on profiles / players, `description?` on players (confidential), `errorType?` on "our error" tags (`ErrorType`: serve · reception · attack · block · set · netFault · other), `ExportFile.photos: Photo[]`. Pure logic: `photos.ts` (data URI / description rules), `photoCrop.ts`, `performance.ts` (rallies on court with libero swap, ±, net points, rating, error rates — DECISIONS #152), `errorTagging.ts` (`chooseLastErrorType`, the tagged player always fits the type), `pointTags.setLastErrorType`, `lastRally.plausibleErrorTypes`.
- **Seasons (v7, data model v8)**: `Season` (season / tournament, dates, place) and `Opponent` (per season) collections; every `Match` has `seasonId` + `opponentId` (+ `opponent` name kept in sync). `src/domain/seasons.ts` (upgrade, validation, records, `alignIncomingByName` for merges), `matchForm.ts`, `statsSeason.ts`. Routes `/team/[teamId]/season/[seasonId]?tab=matches|opponents|stats`, `/team/[teamId]/season-new?seasonId=` (modal), `/team/[teamId]/match-new?seasonId=`. UI in `src/features/seasons/`, `src/features/matchForm/`. Team's Matches tab = season boxes; the team's old `season` text is hidden in the UI.
- **Photos** (`src/store/photoStore.ts`): one AsyncStorage key per photo (`volley-lineup-photo:<id>`, data URI ≤ 256 px JPEG), NOT in the main store; orphans pruned and dangling `photoId`s cleared automatically on profile / player changes; `transferSnapshot()` for export, `replacePhotos` / `putPhotos` for import. `<Photo photoId size fallback>` component. Picking: `src/lib/pickPhoto*.ts` (expo-image-picker + expo-image-manipulator), UI in `src/features/photos/`.
- **Descriptions**: unlock state in an in-memory store (`src/features/descriptions/descriptionLock.ts`, never persisted), unlock via `src/lib/unlock*.ts` (expo-local-authentication on phones, a confirmation dialog on web / without a device lock), auto-lock on background / hidden tab. Exported only when "Include descriptions" is ticked while unlocked.
- **Store** (`src/store/`): one `useAppStore` (profiles, teams, players, matches, presets, currentProfileId, language). Version 11 with migrations v1→…→v11 in `migrations.ts` (v10 → v11 adds `tourMode: null` + `tourSeen: []`; v8 → v9 seasons, v9 → v10 adds `themeMode: 'dark'` + `dyslexiaFont: false`; `Team.photoId` optional) (v3→v4 changes nothing; v4→v5 adds `chipLabel: 'number'`; v5→v6 adds `roles: {}` + `liberoActive: true` to sets and presets; v6→v7 turns per-player `roles` into a `formation`; v7→v8 changes nothing — the v6.0 fields are optional). Device settings (not exported, kept on Delete all data): `language`, `chipLabel`, `themeMode`, `dyslexiaFont` (`PlayerChip` shows names when `'name'`). List selectors are hooks with `useShallow` (Zustand v5 loops otherwise).
- **Features** (`src/features/`): roster, team, lineup (builder; `useLineupDraft` is the generic editor), rotation, live (whole match: `LiveMatch` → `LiveSetView` / `NextSetSetup` / `SetWonPanel` / `MatchSummary`, tag row `PointTagRow` + `usePointTagging`, result label `matchResult.ts`), stats (tables with fixed first column), presets, print (choice dialog with/without results), profile, settings; v6: photos, playerDetail, descriptions, performance.
- **i18n**: `src/i18n/en/*.ts` + `src/i18n/de/*.ts`, `useT()` hook; the German type is derived from English so missing keys fail typecheck; ESLint forbids importing `@/i18n/en` directly.
- **Shared UI (v8.3)** in `src/components`: `Dialog` + `useDialogStyles`, `ConfirmDialog` / `useConfirm`, `ChoiceChip`, `TextField`, `ListRow`, `NotFound`, `SetChipFilter`, `ScreenTitle`, `formStyles.ts`, `useGoBack`; `CourtSlot` / `courtStyle`, `useCourtMotion`; app tab bar in `src/features/appTabs`; `parseTab` in `src/lib`. Test helpers in `src/test-utils/` (`seedApp`, `seedGolden`, `renderApp`, `resetStores`, `makePlayer`, `makeSet`, `seasonRefs`, …).
- **Guided tour (v9)**: `src/domain/tour.ts` (pages, quick pages, `tourAction`, tab → page helpers), `src/features/tour/` (non-persisted session store with per-screen focus tokens, `useTourPage(page)` — call once per screen with the _shown_ tab's page, `TourHost` in `app/_layout.tsx`, choice dialog, step popup + `TourVisual`, offer, Profile `TourSection`; tip texts in `steps.ts` + `src/i18n/{en,de}/tour.ts`). Store v11 device settings `tourMode` / `tourSeen`. **New screens need a tour page**: add it to `TourPage`, the page lists, steps and strings, and call `useTourPage`.
- **Platform code** only in `src/lib/*.web.ts` / `*.native.ts` (file transfer, print, drag activation, switch props, document language).
- **Theme (v8)**: `src/theme/` — `darkColors` / `lightColors` (same tokens; use `primaryText` / `highlightText` / `secondaryText` for coloured text and outlines on backgrounds, `on*` for text on fills, `onCourt` on the orange court), `darkPositionColors` / `lightPositionColors`, `ThemeProvider` (props `mode`, `dyslexiaFont`, wired from the store in `app/_layout.tsx` → `ThemedRoot`), `useTheme()`, `makeStyles((theme) => ({...}))` → `useStyles()` (cached per theme; injects the OpenDyslexic family at 0.85× size into every text style; `inlineFontSize()` for inline sizes), `navigationTheme.ts`. No colour literals outside `src/theme` (a test enforces it). `print.ts` stays the light print theme. Fonts: `assets/fonts/OpenDyslexic-*.otf` (OFL), loaded by `src/lib/fonts.ts` (`useAppFonts`, waits only when the font is on, max 3 s).
- **v8 domain helpers**: `dates.ts` (`formatDate` dd.mm.yy, `parseDateInput` d.m.yy / dd.mm.yyyy / ISO → ISO, `formatDateInput`, `formatTimestampDate`, `todayInput`), `playerNames.ts` (`fullName`, `shortName` "Anna" / "Anna M.", `numberAndName`), `rosterGrid.ts`, `teamAvatar.ts`, `tabMotion.ts` (barrel over `slideMotion` / `tabDrag` / `pagerLayout`), `courtMotion.ts` (which court changes are rotations that slide).
- **v8 components**: `SlideTransition`, `SwipeTabs` + `NoTabSwipe` (v8.1.1: real pager `TabPager` / `useTabPager` / `usePagerGesture` / `pagerWorklets` — tabs ±1 stay mounted keyed by tab, every SwipeTabs needs `renderTab`; app tab bar: `PagerScene` + `VisibleScenes`) (stats tables, tag rows, text fields), `CourtMotion` (inert ghost layer; `Court` props `slotKeys` / `renderSlotStatic`), `TeamAvatar`, `PlayerCard` (roster grid), `AppearanceSection` (Profile tab). `src/lib/inert*.ts`, `src/lib/themeColor*.ts`. Icons are generated by `scripts/generate-icons.py` from `assets/source/app-icon-source.png` (don't hand-edit `assets/images`).

---

## 4. How work is done here (the orchestrator pattern)

The owner gives short requests and is usually not watching. The pattern that worked:

1. **Read** the docs above. If a request is ambiguous, pick a sensible interpretation, say it in one line, and go (the owner prefers action over questions).
2. **Shared foundation yourself** first (data model/types, migrations, export schema, version bumps, docs), merged before workers start, so parallel work doesn't conflict.
3. **Workers** (Agent tool, `isolation: "worktree"`, background) for independent features — one branch + PR each, with a precise brief: task, owned files, forbidden files, design decisions already made, tests, "don't edit DECISIONS.md (list decisions in the PR body)", "don't merge".
4. **Independent reviewer** agent per PR (didn't write the code): runs lint/typecheck/tests/web export, verifies rules by hand, Playwright at 375 and 1280 px, EN + DE. Forward findings to the worker via SendMessage.
5. **Merge** only with green CI (check `pull_request_read get_check_runs`). Squash when intermediate commits don't build.
6. **QA agent** over the acceptance checklist after a version's features are in.
7. **Docs**: add DECISIONS entries centrally (one PR), tick PLAN checklists, add the version to `docs/README_LEGACY.md` (Version history) and update the "What's new" line in `README.md`.
8. **Release** (§5), then report to the owner: link, what's new, what's verified, what isn't.

Small requests (layout tweaks) are faster done yourself; still use a branch + PR + green CI.

---

## 5. Releasing a version

1. Bump `version` in **both** `app.json` and `package.json` (e.g. 2.3.0) → `npm install --package-lock-only`. Android `versionCode` is derived (2.3.0 → 20300) in `app.config.js`, so the APK installs as an update.
2. Merge to `main` (CI green).
3. GitHub MCP: `actions_run_trigger` → `run_workflow`, `workflow_id: android-apk.yml`, `ref: main`, `inputs: {"release": true}`. It builds `volley-lineup-<version>.apk` (~25 min) and creates tag + release `v<version>`. It fails if that release already exists.
4. Confirm with `get_release_by_tag v<version>`.

**This session's git proxy cannot push tags** — always use the manual workflow run above (pushing `v*` tags only works from the owner's machine).

---

## 6. Gotchas learned the hard way

- **Installing packages**: the sandbox can't reach `api.expo.dev` → `EXPO_OFFLINE=1 npx expo install <pkg>`. Note new deps in DECISIONS.
- **RNTL v14 is async**: `await render(...)`, `await fireEvent.press(...)`. Route tests use `renderRouter` from `expo-router/testing-library` (set `useAppStore.setState({ hydrated: true })` first). Global Jest timeout 30 s.
- **Jest mocks** for worklets/Reanimated/RNGH are in `jest.setup.ts` (Reanimated 4.7 init stub) — don't add per-file hacks.
- **Worktrees** live in `.claude/worktrees/` (git-ignored; Jest/haste ignore it at the root only).
- **react-native-web ignores `accessibilityState`** → also set `aria-checked` / `aria-selected` / `aria-disabled`.
- **Zustand v5**: never return fresh arrays/objects from a selector without `useShallow`.
- **Persisted shape changes** need: store version bump + migration in `src/store/migrations.ts`, export `schemaVersion` bump + upgrade of old files in `exportSchema.ts`, the zod Same<> type guard, consistency checks, tests for v1/v2/... upgrades.
- **Played sets** (with live `events`) lock the lineup (#68); deleting a player in a played set is blocked (#73); presets/templates must not edit locked sets.
- **Emulator** (manual `android-smoke.yml`): AVD home must be pinned (`ANDROID_AVD_HOME`), boot can take > 10 min, the runner may run out of memory — don't gate PRs on it.
- **Merge conflicts in DECISIONS.md**: let workers list decisions in PR bodies; add them centrally.
- **Stop hook**: commit and push before ending a turn (untracked/uncommitted files trigger it). The session branch must be kept in sync with `main`.
- Agents' scratch files go in the session scratchpad, each in its own subfolder.
- **Parallel agents and git**: give every agent a unique local branch name (`review-pr40-$RANDOM`), never a shared one like `review` — worktrees share refs and one agent's checkout moved another's HEAD in v4.
- **Before committing on a branch an agent pushed to**: `git checkout -B <branch> origin/<branch>` can leave old files in the working tree; check `git diff --stat origin/<branch>` before `git add -A` (in v5 a docs commit silently reverted an agent's test rewrite).
- **Owner feedback can change the model**: v4 put roles on players, the owner wanted them on court spots (v5). For volleyball domain questions, check `docs/VOLLEYBALL_RULES.md` first and ask the owner one short question with options (AskUserQuestion) when the model itself is unclear.
- **Pre-wire shared files in the foundation PR** (i18n files per worker in `en.ts`/`de.ts`, new routes in `app/_layout.tsx` + `parentRoute.ts`, nav strings): it removed almost all merge conflicts between parallel workers in v3.
- **Before merging a PR whose base is behind `main`**: merge `origin/main` into its branch (in a scratch worktree), run the checks, push the merge commit, and merge only after CI is green on that SHA.
- **Header titles on web**: the header's title container doesn't shrink, so long titles overflow the page; `HeaderTitle` caps its own width — keep using it.
- **Branch names**: old feature branches still exist on origin (e.g. `feat/live-match` from v2) — pick new names; the git proxy can't delete remote branches.
- **Photo store order**: save a photo (`setPhoto`, in memory at once) before pointing a profile / player at it — the prune deletes unreferenced photos and clears `photoId`s without a photo on every profile / player change. Tests must seed `usePhotoStore` before `updatePlayer({ photoId })`.
- **Live screen height**: anything added to the live screen must keep the court + Substitution visible at 390×844 (DECISIONS #75, #126); the tag row is one sideways-scrolling 44 px line for that reason (#164).
- **Agents and PR footers**: workers kept writing `_Generated by Claude Code_` footers — give them the exact footer and check it before merging.
- **Ids in URL params**: upgraded opponent ids contain "%" (`encodeURIComponent`); expo-router decodes params twice on web, so don't put such ids in URLs (#177).
- **Test helper** `seasonRefs(teamId, name)` (now in `src/test-utils/seasonRefs.ts`) creates a real season + opponent for `addMatch` in tests.
- **Styles go through `makeStyles`** (v8): a module-level `StyleSheet.create` with colours or text won't follow the theme or the dyslexia font. Name the factory parameter `theme` (`t` is the translation object).
- **Test the dyslexia font at 375 px in German**: OpenDyslexic is ~1.8× taller and wider; v8 needed font-only layout tweaks (#200). Check new screens with it.
- **Phone-only behaviour isn't visible in Playwright**: react-native-screens is off on web, so a navigator hiding scenes (`display: 'none'`) only shows on native — check with Jest (jest-expo runs as native) and read the navigator source; v8.1.1 nearly shipped a blank app-tab neighbour.
- **Web touch**: RNGH v3 `GestureDetector touchAction` has no effect with hook gestures — put `touchAction: 'pan-y'` in the gesture config (`SwipeTabs.tsx`), and test vertical scrolling with real touch (`hasTouch` + CDP), not only mouse.
- **PR footers**: the GitHub MCP / agents kept ending PR bodies with `_Generated by …_`; check and fix the body before merging (also in v8).
- **Label in name** (WCAG 2.5.3): an `accessibilityLabel` must start with the button's visible text — reviewers check this. A guard test (`__tests__/labelInName.test.tsx`) renders the app and checks every label (EN + DE).
- **Export golden** (`src/domain/__golden__/`): fixed input + v1–v9 files must export / import byte for byte. Only rewrite with `UPDATE_GOLDEN=1` for a real schema change; the folder is in `.prettierignore` (Prettier broke the byte match once).
- **Screenshot harness** `scripts/screenshots.js` (496 PNGs: 31 screens × 375/1280 × EN/DE × dark/light × font; `--compare` with ImageMagick AE). Proves "no visible change" for refactors; Settings shows the app version, so a version bump changes that line only.
- **Web QA with a fixed clock**: `page.clock.setFixedTime` makes every tap after a builder drag count as "just dragged" (`DragContext` compares `Date.now()`); move the clock forward between steps.
- **Tests run with no tour**: `jest.setup.ts` sets `tourMode: 'none'`; the screenshot harness seeds store v11 with `tourMode: 'none'`. With a fresh browser the first-start tour choice covers the screen.
- **Memoised domain results are shared**: copy before changing anything returned by `getMatchState`, `setStats`, `replay` & co.

---

## 7. Checklist for starting a new version

- [ ] `/start` → read docs, `git fetch origin main`, `npm ci`, run `npm run lint && npm run typecheck && npm test`.
- [ ] Write the version's plan into `docs/PLAN.md` (new section with features, data model changes, acceptance checklist).
- [ ] Foundation PR (types/store/export migrations + version bump if the data shape changes).
- [ ] Workers → reviews → merges → QA → fixes.
- [ ] DECISIONS + `docs/README_LEGACY.md` version history + `README.md` "What's new" + PLAN ticks → release (§5).
- [ ] `/wrap-up` before the chat ends.
