# v8.3 code-health audit

Audit of `main` @ `725e201` (app 8.2.0), done before any v8.3 change by two independent read-only
audit agents: **A** (performance, bundle, tooling) and **B** (architecture, types, tests, accessibility,
docs). Their full reports are below (Appendix A and B). This top part is the ranked decision list
for v8.3 ("Code health": no visible or behavioural change, same stored data and export output).

Status: **done** / **skipped** (v8.3 shipped as app 8.3.0; PRs #70–#76). Results and numbers are in the Results section.

## Baseline (8.2.0)

| Metric                                                  | Value                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Web JS (all chunks, minified)                           | 3,289,876 B (~715 KB gzip); 3,112,919 B loaded before the first screen                                             |
| Tests                                                   | 110 suites / 1198 tests; ~46 s warm locally (4 cores), CI job 3 min 36 s (one serial job)                          |
| `src/domain` coverage                                   | 100 % (statements, branches, functions, lines)                                                                     |
| ESLint run                                              | ~20 s (Prettier inside ESLint ~4.6 s, `import/namespace` ~4.1 s)                                                   |
| Non-test files over 150 lines                           | 22 (8 components / screens / hooks; 7 domain files over 250; `exportSchema.ts` 648)                                |
| `as` casts in app code (excluding `as const`)           | 76 (+ 4 `as unknown as`); 24 provably unnecessary                                                                  |
| Lint / type suppressions                                | 7 (5 `react-hooks/*` in app code, 1 in a test, 1 file-level in `jest.setup.ts`); 0 `ts-ignore` / `ts-expect-error` |
| Dead exports                                            | 3 unreferenced + `Placeholder`; 13 app exports used only by tests; 6 unused i18n keys                              |
| Accessible names (WCAG 2.5.3)                           | 87 label pairs × EN/DE: 30 don't contain the visible text, 43 don't start with it                                  |
| Per point on the live screen (desktop, 60-match season) | ~30 ms JS, mostly hidden stack screens recomputing every match result (est. 150–300 ms on a mid-range phone)       |

## Ranked findings and decisions

Owner: **F** = foundation PR (orchestrator), **A** = performance worker, **B** = domain / store worker,
**C** = components / hooks worker, **D** = accessibility / tests / docs worker.

| #   | Finding                                                                                                                                                               | Effort | Risk                          | Decision                                                                                                                                | Owner                               | Status  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------- |
| 1   | A1 Domain results (`getMatchState`, `setStats`, `setPerformance`, `replaySteps`) recomputed for every match on every store change; cache by object identity (WeakMap) | M      | low                           | DO                                                                                                                                      | A                                   | done    |
| 2   | A3 Pager / `NoTabSwipe` gesture configs rebuilt every render (RNGH 3 re-creates the native gesture + worklets) → `useMemo`                                            | S      | low                           | DO                                                                                                                                      | A                                   | done    |
| 3   | A2 `SeasonsTab` passes each `SeasonCard` a fresh array (memo never hits)                                                                                              | S      | low                           | DO                                                                                                                                      | A                                   | done    |
| 4   | A4 13 inline `<Stack.Screen options={{…}}>` → `setOptions` + navigator render on every render                                                                         | S      | low                           | DO                                                                                                                                      | A (+C for the two screens C splits) | done    |
| 5   | A6 Performance neighbour of Live recomputes unchanged sets                                                                                                            | –      | –                             | DO (comes with A1)                                                                                                                      | A                                   | done    |
| 6   | B1 Split `exportSchema.ts` (format / upgrades / consistency / merge) behind the same import path                                                                      | M      | very low                      | DO                                                                                                                                      | B                                   | done    |
| 7   | B6 Store migrations and export upgrades duplicate the legacy traversal; `isRecord` ×4 → `legacyData.ts`                                                               | S      | low                           | DO                                                                                                                                      | B                                   | done    |
| 8   | B12 Dead code: `useShortNames`, `LineupEditor`, `Placeholder`, old match-form validation in `roster.ts`, test-only exports, 6 unused i18n keys                        | S      | none                          | DO                                                                                                                                      | B                                   | done    |
| 9   | A5 zod's ~40 locales are 299 KB of the web bundle; zod is used by `roster.ts` only for form checks → plain checks (option b)                                          | M      | low                           | DO if the measured startup JS drops; else skip                                                                                          | B                                   | done    |
| 10  | B2 / B4 Split `seasons.ts`, `lineupSheet.ts`; `durationParts` / `playerName` used by UI from the print module                                                         | S      | very low                      | DO                                                                                                                                      | B                                   | done    |
| 11  | B5 Split `tabMotion.ts` (slide / drag / pager layout) — pure move, worklet directives kept                                                                            | S      | medium (native-only)          | DO as a pure move behind the same path                                                                                                  | B                                   | done    |
| 12  | B3 Split `liveSet.ts` (score rules / sub rules / court view)                                                                                                          | M      | low                           | DO after A's PR (same file)                                                                                                             | B                                   | done    |
| 13  | B9 Court rows ×3, `pad` ×4, `POINT_KINDS` re-listed                                                                                                                   | S      | none                          | DO                                                                                                                                      | B                                   | done    |
| 14  | B16 / B17 Unnecessary and avoidable `as` casts                                                                                                                        | S      | none                          | DO (B: domain / store / lib; C: components / features / app)                                                                            | B, C                                | done    |
| 15  | B18 Suppressions: drop the two removable ones                                                                                                                         | S      | low                           | DO; keep the animation `exhaustive-deps` ones                                                                                           | C                                   | done    |
| 16  | B7 Six modals copy the same backdrop / card styles → one `Dialog` shell                                                                                               | S–M    | low                           | DO                                                                                                                                      | C                                   | done    |
| 17  | B8 `SetFilter` ≈ `SetSwitch`; `parseTeamTab` ≈ `parseSeasonTab`; `MatchForm` lives in `roster/components`                                                             | M      | low                           | DO                                                                                                                                      | C                                   | done    |
| 18  | B10 Components / screens over 150 lines (`Court`, `CourtMotion`, `(tabs)/_layout`, `match/[matchId]/index`, `useLineupDraft`, `DragContext`)                          | M      | low                           | DO as pure extracts (same JSX tree)                                                                                                     | C                                   | done    |
| 19  | B8 Shared UI kit lives in `features/roster/components` (40 importers) → `src/components`                                                                              | M      | low                           | DO last (import churn), after A–D merged                                                                                                | C                                   | done    |
| 20  | B25 / B26 Accessible names that don't start with the visible text (EN + DE)                                                                                           | M      | low (screen-reader text only) | DO (owner allowed it) + a guard test                                                                                                    | D                                   | done    |
| 21  | B21–B23 Test helpers: 20 local `seed()`s, pager duplicate testIDs, Reanimated spies                                                                                   | M      | low                           | DO (shared `src/test-utils`, migrate where touched)                                                                                     | D                                   | done    |
| 22  | B27 / B28 / B13 / B14 WORKER_BRIEF (v3-era), HANDOFF §2/§3, CLAUDE.md i18n path, stale code comments                                                                  | S      | none                          | DO (WORKER_BRIEF: D; HANDOFF / CLAUDE.md: F at release; comments: owner of the file)                                                    | D, F                                | done    |
| 23  | A11 Prettier inside ESLint, `import/namespace` redundant, no lint cache                                                                                               | S      | low                           | DO                                                                                                                                      | F                                   | done    |
| 24  | A12 CI: one serial job, no Jest / ESLint cache; Pages deploy repeats lint / typecheck / tests                                                                         | S      | low                           | DO                                                                                                                                      | F                                   | done    |
| 25  | A10a Five tsc flags with zero errors (`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`)                | S      | none                          | DO                                                                                                                                      | F                                   | done    |
| 26  | Export golden test + screenshot script so every PR can prove "no change"                                                                                              | S      | none                          | DO                                                                                                                                      | F                                   | done    |
| 27  | A10b `noUncheckedIndexedAccess` (12 app-code spots, 283 in tests)                                                                                                     | M      | low                           | SKIP — the app-code fixes need `!` or new defensive branches (more casts, uncovered domain branches); revisit with a data-model version | –                                   | skipped |
| 28  | A20 `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`                                                                                                | M      | med                           | SKIP — touches stored-data optional fields                                                                                              | –                                   | skipped |
| 29  | A8 Freeze hidden pager pages (`<Activity>`) / `freezeOnBlur`                                                                                                          | M      | high                          | SKIP — the neighbour page must be live at drag start (#218); `freezeOnBlur` is forced off in Expo Router 58                             | –                                   | skipped |
| 30  | A15 Virtualise roster / match / stats lists                                                                                                                           | M      | high                          | SKIP — ~15 players / ~60 matches, nested in pager + ScrollView; layout and scroll could change                                          | –                                   | skipped |
| 31  | A16 Blanket `React.memo` / `useCallback`                                                                                                                              | S      | low                           | SKIP — little gain after A1                                                                                                             | –                                   | skipped |
| 32  | A9 Store rewrites the whole JSON on every rally (~1 MB per 60-match season)                                                                                           | L      | high                          | SKIP for v8.3 (changes storage); **open item for a data task** (Android AsyncStorage row / DB size limits)                              | –                                   | skipped |
| 33  | A14 OpenDyslexic downloaded at start even with the font off; splash / hydration                                                                                       | S      | med                           | SKIP — lazy font could flash when switching it on                                                                                       | –                                   | skipped |
| 34  | A17 / A18 Reanimated layout-animation code, lazy German strings, Metro tree shaking                                                                                   | M      | med                           | SKIP — unsupported or too little gain                                                                                                   | –                                   | skipped |
| 35  | B11 Split `appStore.ts` into slices                                                                                                                                   | M      | med                           | SKIP — touches persistence wiring                                                                                                       | –                                   | skipped |
| 36  | B8 Merge `Segmented` / `SetupFormationRow` / `SetTabs` / `SetPicker`                                                                                                  | M      | med                           | SKIP — similar but different layouts (pixel risk)                                                                                       | –                                   | skipped |
| 37  | B14 Rename i18n namespaces (`presets.nav`, `roster.matches`…)                                                                                                         | M      | low                           | SKIP — churn across tests; documented instead                                                                                           | –                                   | skipped |
| 38  | B20 Retype `Stats.players` records                                                                                                                                    | S      | low                           | SKIP — touches stats UI; the casts go with #14                                                                                          | –                                   | skipped |
| 39  | A13 Reanimated `.set()` / `.value` consistency                                                                                                                        | S      | low                           | SKIP unless touched — cosmetic                                                                                                          | –                                   | skipped |

## Results

All DO rows are done (PRs #70 foundation, #71 components, #72 accessibility / test helpers / WORKER_BRIEF, #73 domain and
store, #74 performance, #75 `liveSet` split, #76 shared UI kit). Every PR was checked by an independent reviewer
against the golden test and 496 screenshots (0 differing pixels each). Partial: row 17 left `SeasonFilter` as it is
(its labels and accessible names differ from the set filters).

| Measure                                                                                                  | 8.2.0                                                                                | 8.3.0                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMatchState` computed per scored point (60-match season, team → season → builder → live in the stack) | 187                                                                                  | 1                                                                                                                                                                                                                    |
| `setResult` computed per point                                                                           | 738                                                                                  | 1                                                                                                                                                                                                                    |
| Set replays per point                                                                                    | 6                                                                                    | 3                                                                                                                                                                                                                    |
| React commits per point / navigator + header re-renders                                                  | 2 / 1 + 21                                                                           | 1 / 0                                                                                                                                                                                                                |
| Component renders per point                                                                              | 2617                                                                                 | 2472 (the hidden season screen's 60 `MatchRow`s remain, row 31)                                                                                                                                                      |
| Live point-to-paint, web, median at 4× / 6× CPU throttling                                               | ~297 / ~450 ms                                                                       | ~258 / ~362 ms (−10 to −20 %)                                                                                                                                                                                        |
| Web JS loaded by `index.html` before the first screen                                                    | 3,112,490 B (718 KB gzip)                                                            | 2,569,978 B (620 KB gzip, −17 %); zod now only in the Settings chunk. Opening on `/` still fetches the Settings chunk (app-tab pager), so only deep links (e.g. `/match/m1/live`: 3.17 → 2.62 MB) download less (QA) |
| All web JS                                                                                               | 3,286,517 B                                                                          | ~3.29 MB (+0.2 %, module wrappers)                                                                                                                                                                                   |
| ESLint run                                                                                               | ~20 s                                                                                | ~12 s cold, ~1 s cached                                                                                                                                                                                              |
| CI wall time                                                                                             | 3 min 36 s (one job)                                                                 | ~2.5–3 min (three parallel jobs)                                                                                                                                                                                     |
| Tests                                                                                                    | 110 suites / 1198                                                                    | 117 suites / 1442 (golden 15, label guard 220, new unit tests; 5 tests of deleted dead code removed)                                                                                                                 |
| Test run, warm, local                                                                                    | ~46 s                                                                                | ~23 s (`npx jest --silent`, second run)                                                                                                                                                                              |
| `src/domain` coverage                                                                                    | 100 %                                                                                | 100 %                                                                                                                                                                                                                |
| `as` casts in app code (AST count, `as unknown as` = 2)                                                  | 84 (4 × `as unknown as`)                                                             | 44 (1)                                                                                                                                                                                                               |
| Lint / type suppressions (app code + tests)                                                              | 5 + 2                                                                                | 4 + 1                                                                                                                                                                                                                |
| Components / screens / hooks over 150 lines                                                              | 8                                                                                    | 2, kept on purpose: `useTabPager.ts` 164 (coupled shared values; not verified on a phone), `LiveSetView.tsx` 160 (live-screen height budget)                                                                         |
| Big domain files                                                                                         | `exportSchema` 648, `seasons` 344, `liveSet` 339, `lineupSheet` 334, `tabMotion` 263 | 185, 17 (barrel), 254, 210, 10 (barrel) — each split by responsibility                                                                                                                                               |
| Accessible names not starting with the visible text (EN + DE)                                            | 73 (+ tag / libero chips)                                                            | 0, guarded by `__tests__/labelInName.test.tsx` (exceptions: bare numbers, position codes)                                                                                                                            |

Found and left for later (not v8.3 — they would change behaviour or need a phone):

- The store rewrites its whole JSON on every rally (~1 MB per 60-match season); Android AsyncStorage row / database size
  limits could be reached after a few seasons (row 32). A data task.
- The pager / `NoTabSwipe` gesture callbacks are not worklets (the `as` casts hide them from the worklets plugin), so on
  a phone they run on the JS thread — as in 8.2 (DECISIONS #229). Check on a device first.
- Three replays per point remain because three hooks pass different `players` arrays.
- On web, `/` and `/teams` still load the Settings chunk (with zod) right after start, because the app tab bar mounts
  all three tabs.

---

## Appendix A — performance and tooling audit

Repo state audited: `main` @ `725e201` (v8.2.0). Read-only; nothing in the repo was changed.
Scratch work (bundle maps, benchmarks, tsc configs, jest JSON) is in
`(audit scratch folder, not kept) a-work/`.

Ground rule for v8.3: same pixels, texts, animations, gestures, stored data and export output. Every
DO item below is chosen to meet that rule. Anything that could change what the user sees is under SKIP.

---

### Baseline numbers

#### Web bundle (`expo export -p web --source-maps`, 22 s build)

|                                                                                                                                                                            | bytes (minified) | gzip -9 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------: | ------: |
| **All JS** (25 files)                                                                                                                                                      |    **3,289,876** | ~715 KB |
| `__common-*.js` (loaded at start)                                                                                                                                          |        1,986,417 | 420,548 |
| `entry-*.js` (loaded at start)                                                                                                                                             |        1,122,813 | 294,513 |
| `__expo-metro-runtime`                                                                                                                                                     |            3,689 |       – |
| Biggest route chunks: `live` 46,877 · `settings` 23,283 · `team/index` 20,054 · `index` 13,884 · `[seasonId]` 11,868 · `[playerId]` 11,046                                 |                  |         |
| JS loaded before the first screen (runtime + common + entry)                                                                                                               |    **3,112,919** | ~715 KB |
| Fonts: Ionicons.ttf 389,724 (fetched on the first icon render) · OpenDyslexic Regular 175,872 + Bold 184,472 (fetched at **every** start, even with the font off, see A14) |                  |         |

Minified bytes by package (sectioned source maps, module line ranges; script `a-work/mapsize.js`, full output `a-work/bundle-by-package.txt`):

| package                      |  KB min | notes                                                                                                                          |
| ---------------------------- | ------: | ------------------------------------------------------------------------------------------------------------------------------ |
| react-native-reanimated      |     652 | 195 KB is `layoutReanimation/*` (Zoom, Bounce, Flip…); the app uses none of it. Metro doesn't tree-shake.                      |
| **zod**                      | **528** | **299 KB min / 41 KB gzip of it is `zod/v4/locales/*`** (all ~40 languages) + 40 KB JSON-schema helpers. zod gzip total 97 KB. |
| expo-router                  |     465 |                                                                                                                                |
| react-native-web             |     310 | incl. VirtualizedList 27 KB (unused)                                                                                           |
| react-native-gesture-handler |     273 |                                                                                                                                |
| react-dom                    |     204 |                                                                                                                                |
| src/domain                   |      73 |                                                                                                                                |
| src/i18n de + en             | 41 + 37 | both languages always loaded                                                                                                   |
| @expo/vector-icons           |      37 | Ionicons glyph map JSON 30 KB                                                                                                  |
| semver                       |      21 | pulled in by reanimated/worklets version checks                                                                                |

Metro tree shaking (`EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1`, also with
`experimentalImportSupport` in a scratch copy): 3,289,876 → 3,191,680 / 3,216,287 bytes (**−2 to −3 %**). zod
and reanimated barely shrink (namespace re-exports). Not worth it (A18).

#### Tests (Jest 30, 4 cores)

| run                                                             |                                                                      wall time |
| --------------------------------------------------------------- | -----------------------------------------------------------------------------: |
| `npx jest --silent`, warm cache                                 | **25.3 s** (111 suites, sum of suite times 71 s; domain suites only 8 s of it) |
| `jest --ci --coverage --no-cache`, as CI runs it, cold          |                                                                       **67 s** |
| GitHub CI step `npm test -- --ci --coverage` (last run on main) |                                                                      **106 s** |

Slowest 10 suites (warm): `lineup/formation` 3.8 s · `live/WholeMatch` 3.5 s · `roster/rosterFlow` 3.4 s ·
`seasons/seasons` 2.7 s · `components/TabPager` 2.3 s · `lineup/roles` 2.0 s · `live/PointTags` 2.0 s ·
`__tests__/tabSwipe` 1.9 s · `profile/profileFlow` 1.8 s · `matchForm/matchForm` 1.8 s. They are evenly
spread, with no single outlier. The slowest single test is `rosterFlow` "creates a profile, a team and 12 players" at 1.8 s.

(During the audit another agent's untracked `src/domain/__golden__/` showed up in the working tree for
a while and failed 13 tests. That isn't on `main`, and the cold run above excludes it.)

#### CI (`.github/workflows/ci.yml`, last main run 3 min 36 s)

`npm ci` 29 s → lint 26 s → typecheck 9 s → **jest 106 s** → web export 41 s. All of these run one after the other in one job.
Locally: lint 21.7 s, of which the `prettier/prettier` rule is 4.6 s, `import/namespace` 4.1 s and
`react-hooks/static-components` 4.6 s. `tsc --noEmit` takes 6.6 s and `prettier --check .` takes 5.6 s.

#### TypeScript strict flags (temp tsconfig extending the repo one; 0 errors today)

| flag                                 | errors total |                           in prod code | in tests | verdict          |
| ------------------------------------ | -----------: | -------------------------------------: | -------: | ---------------- |
| `noImplicitOverride`                 |            0 |                                      0 |        0 | free: enable     |
| `noFallthroughCasesInSwitch`         |            0 |                                      0 |        0 | free: enable     |
| `noImplicitReturns`                  |            0 |                                      0 |        0 | free: enable     |
| `noUnusedLocals`                     |            0 |                                      0 |        0 | free: enable     |
| `noUnusedParameters`                 |            0 |                                      0 |        0 | free: enable     |
| `noUncheckedIndexedAccess`           |          302 |                      **19 (10 files)** |      283 | feasible (A10)   |
| `exactOptionalPropertyTypes`         |           81 |                          74 (43 files) |        7 | skip (A20)       |
| `noPropertyAccessFromIndexSignature` |          371 | 85 (5 files, mostly `exportSchema.ts`) |      286 | skip, style only |

#### Dependencies

- `EXPO_OFFLINE=1 npx expo install --check` → "Dependencies are up to date" (Expo warns that offline
  validation is unreliable; re-run online before relying on it).
- `depcheck` / `knip` / `source-map-explorer` are not installed. I grepped every dependency's imports: **no unused
  dependency**. The ones with no direct import are needed anyway: `expo-linking`, `expo-constants` (peers of
  expo-router), `expo-system-ui` (Android `userInterfaceStyle`), `react-dom`, `react-native-web`, `test-renderer`
  (RNTL 14 peer), `eslint-config-prettier` (used by `eslint-plugin-prettier/recommended`), `@types/*`.

#### Per-point cost (domain benchmarks, Node/Jest on desktop; scripts `a-work/bench/*.bench.test.ts`)

Realistic data: 14 players, sets of 46 rallies with timestamps and tags, matches of 4 sets.

| function                                                                         |                                                              desktop ms |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------: |
| `replaySet` (1 set)                                                              |                                                                    0.11 |
| `getMatchState` (1 match)                                                        | 0.10–0.2 (about half of it is `durationOf`: one `Date.parse` per rally) |
| `lastRally`                                                                      |                                                                    0.04 |
| `matchPerformance` one set / all sets + rows                                     |                                                             0.37 / 0.88 |
| 60 × `getMatchState` (a season's match list)                                     |                                                                **12.9** |
| `opponentRecords` (12 opponents, 60 matches)                                     |                                                                 **5.5** |
| `seasonOverview` (60 matches)                                                    |                                                                 **8.1** |
| `seasonStats` (60 matches)                                                       |                                                               **20–31** |
| `JSON.stringify` of the persisted store (60 matches = **969 KB**)                |                                                                     2.4 |
| same 60 × `getMatchState`, memoised by `match.sets` identity (one match changed) |                                                                 **0.1** |

Phones run Hermes, which has no JIT, so expect these numbers to be roughly 5–10× higher there. That is an estimate; I didn't measure on a device.

---

### How a point is processed on the live screen (trace)

Tap "Point us" → `useLiveSet.point` → `addPoint` → `setLineup` → new `match` / `matches` →
Zustand notifies **every** subscriber. Then the following happens:

**Live screen (`app/match/[matchId]/live.tsx`)**

1. `LiveScreen` re-renders (`useMatch`). `liveSetNumber` → `getMatchState` #1. A new `options` object goes to
   `<Stack.Screen>` → `navigation.setOptions` → the root navigator re-renders (A4).
2. Outer `SwipeTabs` (Live | Performance) re-renders. `usePanGesture` gets a fresh config, so RNGH rebuilds the
   gesture, re-sends the config to native, re-binds shared values and re-registers the worklet handlers. The new `gesture`
   changes the `TabSwipeContext` value, so every `NoTabSwipe` re-renders and rebuilds its native gesture too (A3).
3. `LiveMatch` → `useLiveSet`: `replaySet`, `getMatchState` #2, `undoTarget`, `liveCourtView`, bench. Then
   `needsSetup` → `getMatchState` #3. `usePointTagging` → `lastRally` (replays the set again). A second
   `<Stack.Screen options={{ title }}>` → another `setOptions`.
4. All of `LiveSetView` re-renders (Scoreboard, banners, RallyControls, LiveCourt + CourtMotion, ~6 court chips,
   SubPanel + bench chips, PointTagRow). Each `PlayerChip` also runs `useShortName`, which filters all players, on every store change.
5. **Performance, mounted beside it** (v8.1.1): `MatchPerformance` → `playedSetNumbers` (`getMatchState` #4) +
   `matchPerformance(set N)`. Its inner `SwipeTabs` (sets + All) keeps 3 pages mounted, and **each** recomputes
   `matchPerformance`: set N again, set N−1 (unchanged, but `match` is a new object) and All (0.9 ms). Its gesture config is
   rebuilt as well. On the live screen itself this is about 3–5 ms desktop per point, which is acceptable.

**Hidden screens underneath in the stack (the bigger cost).** The usual path is Teams → team (Matches tab) → season →
match → live. Native-stack keeps every one of these mounted, and they all re-render on the store change: 6. Team screen, Matches tab (`SeasonsTab`): `matches.filter(...)` builds a **new array per season on every render**, so
`SeasonCard`'s `useMemo(seasonOverview, [matches])` never hits. Every season's overview is recomputed: about 8 ms per
60 matches (A2). 7. Season screen, Matches tab: 60 × `MatchRow` → `matchResultLabel` → `getMatchState`, unmemoised: about 13 ms. The Opponents
tab is mounted as the neighbour: `opponentRecords`, about 5.5 ms. 8. Lineup builder `/match/[id]` re-renders (`useMatch`) and calls `setOptions` again. 9. `persist` serialises the whole store (about 1 MB after a 60-match season) and writes it to AsyncStorage.

**Estimated total:** about 30–35 ms of JS on a desktop per point with a 60-match season. On a mid-range Android that is
roughly **150–300 ms**, and it grows linearly with the season. About 90 % of it is recomputing **unchanged** matches on hidden screens.
With A1 and A2 it drops to about 3–5 ms desktop. `freezeOnBlur` would be the textbook fix, but it is **forced to `false` in
Expo Router 58** (`node_modules/expo-router/build/react-navigation/native-stack/views/NativeStackView.native.js:311`,
and the option is marked "@deprecated This option has no effect in Expo Router"), so the fix has to be in the computation.

---

### Findings

#### A1. Memoise per-set / per-match derived data in the domain (WeakMap keyed by object identity)

- **Where:** `src/domain/matchState.ts:76` (`getMatchState`), `src/domain/stats.ts:136` (`setStats`), `:218`
  (`countedSets`), `src/domain/performance.ts:99` (`setPerformance`), `src/domain/liveSet.ts:168/173`
  (`replaySet`/`replaySteps`). Callers: `src/features/seasons/MatchRow.tsx:21`, `src/domain/seasons.ts:269`,
  `stats.ts:243–270`, `features/live/useLiveSet.ts:66–68`, `LiveMatch.tsx` (`needsSetup`), `MatchPerformance.tsx`.
- **Why:** the store is updated immutably, so an unchanged match or set keeps its object identity. Today every list and
  stats view replays **every** match on every store change (see trace 6–7), and `getMatchState` runs about 4× per point
  for the same match on the live screen alone.
- **Best practice:** cache pure derived data by input identity. Zustand recommends memoising expensive derived
  data outside the selector (https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow). The
  React docs make the same point (https://react.dev/reference/react/useMemo#should-you-add-usememo-everywhere).
- **Fix:** a tiny `memoByIdentity(fn)` helper in `src/domain` (WeakMap on the first argument, plus a nested WeakMap
  on `players` where the function takes players). Wrap `getMatchState` (key: `match.sets`), `setResult`, `setStats`,
  `setPerformance` and `replaySteps` (key: the `SetLineup`, then `players`). Results must be treated as read-only:
  `Object.freeze` them in tests, or add a test that the aggregators (`combineStats`/`combinePerformance`) never mutate inputs.
  They don't today, because they build a fresh `total`. Keep 100 % domain coverage. No API change.
- **Effort:** M · **Risk:** low (pure functions, same outputs; the only hazard is a caller mutating a cached result, and
  the tests above catch that).
- **Benefit (measured):** 60-match list 12.9 ms → 0.1 ms; `seasonStats` 20–31 ms → under 1 ms after the first run; live
  screen `getMatchState` ×4 → ×1 per point. That is about 30 ms → 3 ms desktop per point, roughly 150–300 ms → 15–30 ms on a phone (estimate).

#### A2. `SeasonsTab` defeats `SeasonCard`'s memo

- **Where:** `src/features/seasons/SeasonsTab.tsx` (`matches={matches.filter((m) => m.seasonId === season.id)}`),
  `src/features/seasons/SeasonCard.tsx:29`.
- **Why:** a new array on every render means `seasonOverview` runs for every season on every store change, including
  while the team screen is hidden under the live screen.
- **Fix:** `const bySeason = useMemo(() => groupBy(matches, 'seasonId'), [matches])`, then pass `bySeason.get(id) ?? EMPTY`. With
  `useShallow` per season (or A1) unchanged seasons keep their array. **Effort:** S · **Risk:** low ·
  **Benefit:** with A1 it's tidy-up; without A1 it removes about 8 ms desktop per point per 60 matches.

#### A3. Gesture configs are rebuilt on every render (pager + `NoTabSwipe`)

- **Where:** `src/components/usePagerGesture.ts:40–108` (object literal passed to `usePanGesture`),
  `src/components/SwipeTabs.tsx:118–131` (`useNativeGesture` in `Blocker`), `PagerScene.tsx:34–36`,
  `SwipeTabs.tsx:71` (`tabSwipe` memo depends on `gesture`).
- **Why:** RNGH 3.3's hooks memoise on the **config object's identity**
  (`node_modules/react-native-gesture-handler/src/v3/hooks/utils/configUtils.ts:190–207`,
  `src/v3/hooks/useGesture.ts:64–107`). A fresh literal therefore means: clone and remap the config, create a new gesture
  object, `NativeProxy.setGestureHandlerConfig`, `bindSharedValues`, `registerGesture`, and re-workletised handlers via
  Reanimated `useHandler`. This happens on **every** render of every pager. On the live screen that is 2 pagers plus their
  `NoTabSwipe` children, per point and per keystroke in text fields inside pages. The new `gesture` also changes the
  context value, so every `NoTabSwipe` re-renders and rebuilds its own native gesture with `block: gesture`.
- **Best practice:** keep gesture objects stable (RNGH docs:
  https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/gesture-detectors). For Reanimated, avoid
  recreating worklets per render (https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets).
- **Fix:** wrap the config in `useMemo` with deps `[count, testID, settle, …sharedValues]`. All shared values and `settle`
  are already stable (`useCallback` on stable deps), so the gesture changes only when `count` / `reduceMotion` change.
  Do the same in `Blocker` (deps `[gesture, blocked, testID]`). Callbacks and behaviour are unchanged.
- **Effort:** S · **Risk:** low. `TabPager.test`, `tabSwipe.test` and the Playwright touch checks cover it. Watch for a
  stale closure: every value a callback reads must be a dep or a shared value. Today `count` and `settle` are the only
  non-shared ones.
- **Benefit:** saves one native config round-trip plus worklet re-creation per pager per render. This is mostly invisible
  on web. On Android it is UI/JS bridge work on every point. I estimate a few ms per point; I didn't profile it on a device.

#### A4. Inline `<Stack.Screen options={{…}}>` → `navigation.setOptions` on every render

- **Where:** 13 sites, e.g. `app/match/[matchId]/live.tsx:64–68` (headerRight closure),
  `src/features/live/LiveMatch.tsx:63`, `app/match/[matchId]/index.tsx:55`,
  `app/team/[teamId]/season/[seasonId].tsx:74`, `app/team/[teamId]/index.tsx:71`.
- **Why:** expo-router's `Screen` calls `setOptions` in a layout effect whenever the `options` object changes
  (`node_modules/expo-router/build/views/Screen.js`). Each call updates navigator state and re-renders the root
  navigator and header. That is 3–4 times per point (the live screen plus the hidden lineup builder and season/team screens).
- **Fix:** a tiny `useMemo` per site (`useMemo(() => ({ title }), [title])`), or a `ScreenTitle` helper component
  that memoises by the title string. For `headerRight`, memoise with `[view]` and a `useCallback` `changeView`.
- **Effort:** S · **Risk:** low (the same options reach the header) · **Benefit:** 3–4 fewer navigator renders per point.

#### A5. zod ships all ~40 locales to the web bundle (299 KB min / 41 KB gzip)

- **Where:** `src/domain/roster.ts:7`, `src/domain/exportSchema.ts`. zod 4.6.7 `v4/classic/external.js:13`
  `export * as locales from "../locales/index.js"`. Metro doesn't drop unused namespace re-exports (tree shaking
  measured, no effect).
- **Why:** 9.6 % of all shipped JS is translations of zod error messages the app never shows: `roster.ts:75–77` maps
  `issue.message` to its own `FieldErrorCode`, and the export schema only uses pass/fail.
- **Fix, option a (S):** add a `metro.config.js` with a `resolver.resolveRequest` that maps zod's
  `../locales/index.js` (when the origin is inside `node_modules/zod/`) to a 3-line stub re-exporting only
  `en`. Pin zod to the minor version and add a CI check on bundle size so a zod upgrade can't silently break the stub.
  **Option b (M):** replace the small zod use in `roster.ts` with plain checks (same error codes; the existing tests prove it),
  then `exportSchema` is the only zod user. It is reached only from Settings (export/import), so zod (97 KB gzip) leaves
  `__common` and goes to the `settings` route chunk. With option b, also load `exportSchema` via `await import()` in
  `useImport` if it is shared elsewhere.
- **Risk:** (a) low-med (a build-config hack; the visible output is identical). (b) low for the user, med for effort
  (validation rewrite, guarded by the existing roster tests).
- **Benefit (measured):** (a) −299 KB min / −41 KB gzip from the startup JS (−6 % of the gzip). (b) −541 KB min /
  −97 KB gzip (−13.5 %) from the first load.

#### A6. Live screen: the Performance neighbour recomputes unchanged sets

- **Where:** `src/features/performance/MatchPerformance.tsx:45–49`, `PerformancePage.tsx:31–34` (memo key `match`).
- **Why:** set N−1's page recomputes on every point because `match` is a new object, and set N is computed twice
  (overview + page). This is about 1.6 ms desktop per point.
- **Fix:** comes for free with A1 (`setPerformance` memoised per `SetLineup`). Don't add component-level work.
  **Effort:** – · **Risk:** – · **Benefit:** about 1.5 ms desktop per point.

#### A7. Zustand selectors: inventory and verdict

45 `useAppStore(...)` call sites (list in `a-work/`; summary):

- **Good:** every list selector goes through `src/store/hooks.ts` with `useShallow`. Settings use primitives. Actions are
  read via `getState()` in handlers (no subscription). `usePhotoUri` selects one string.
- **`useShortName`** (`src/store/hooks.ts:34–40`, used by every `PlayerChip`): it filters all players on **every** store change,
  per mounted chip (about 20–40 chips across mounted pages and stack screens). The result is a string, so there are no
  extra renders, only CPU, about 1 µs per chip. **Leave it.**
- **`ProfileCard` playerCount** (`src/features/profile/ProfileCard.tsx:21–24`): it builds a Set of team ids on every store
  change while the Profile tab is mounted, which is always (the app tab pager keeps all 3). Cost is tiny (a number result). **Leave it.**
- **`app/team/[teamId]/player.tsx:17`** `isPlayerInPlayedSet(s.matches, …)` scans all events on every store change, but
  only while the editor modal is open. **Leave it.**
- **Whole-object selectors** (`useMatch`, `useTeam`, `usePlayer`) are correct: these screens need the object.
- **Verdict:** no selector change needed. The real cost is derived data (A1/A2), not the selectors.
  Contexts: `ThemeProvider` returns one of 4 prebuilt themes (`src/theme/theme.ts:49–57`), so the value is stable.
  `makeStyles` caches per theme (`ThemeProvider.tsx:55–66`), so its cost is one Map lookup. `TabSwipeContext` is only
  unstable because of A3.

#### A8. Hidden pager pages and hidden stack screens re-render on store changes

- **Where:** `src/components/SwipeTabs.tsx:69–72` (`renderTab` is called for every mounted page on each render),
  `TabPager.tsx:129`.
- **Finding:** yes, ±1 pages re-render with the parent and on their own subscriptions. React 19.3 exposes
  `<Activity>` (`typeof React.Activity === 'symbol'`, Fabric has Offscreen support), but `mode="hidden"` hides the subtree
  (`display: none`). The neighbour page must be **visible and current the instant a drag starts**, and the drag runs on the
  UI thread with no React render (#215, #218). Unhiding on drag start costs a frame, which is the flicker v8.1.1 removed.
  Caching the neighbour's element (a "frozen" page) would show stale data while dragging, e.g. Performance missing the last point.
- **Verdict:** **SKIP** freezing or Activity. A1 + A3 make re-rendering hidden pages cheap, which is the
  zero-visual-change way to get the same win.

#### A9. Persisted store: whole-state JSON write per rally (note for later; not a v8.3 change)

- **Where:** `src/store/appStore.ts:222–245` (`persist` + `createJSONStorage(AsyncStorage)`).
- **Why:** every `set` serialises everything: 969 KB for one 60-match season, 2.4 ms desktop (est. 15–25 ms phone) plus
  the async write. Bigger concern for later: **AsyncStorage on Android stores a key as one SQLite row, and very large
  values (≈ 2 MB, CursorWindow) fail to read back, with a default total DB cap of about 6 MB**. Photos share the same DB. At
  about 1 MB per season this becomes real after 2 seasons. Verify the limits against the installed
  `@react-native-async-storage/async-storage` 2.2 docs (https://react-native-async-storage.github.io/async-storage/docs/limits).
- **Fix:** out of scope for v8.3, because the stored data must not change. Throttling the writes changes crash-safety
  behaviour. Plan a data task, e.g. one key per match (needs a migration) or expo-sqlite / expo-file-system storage. **Effort:** L · **Risk:** high.

#### A10. tsconfig: enable the free strict flags now; `noUncheckedIndexedAccess` is feasible

- **Where:** `tsconfig.json`.
- **Fix:** add `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`,
  `noUnusedParameters` (0 errors each), which locks in today's cleanliness. Then `noUncheckedIndexedAccess`: 19 prod
  errors in 10 files (`domain/formationSteps.ts:43`, `lineupEditing.ts:236`, `liveSet.ts:259`, `matchFlow.ts:29`,
  `templates.ts:55`, `lineupSheet.ts:115`, `RotationStepper.tsx:55/71`, `playerDetail/SeasonStats.tsx:77`,
  `useImport.ts:27`, `fileTransfer.native.ts:40`) plus 283 in tests (mostly `arr[0]!.x`, mechanical).
  It catches real out-of-range bugs, and the codebase already uses `as T` / `??` for this.
  TS docs: https://www.typescriptlang.org/tsconfig/#noUncheckedIndexedAccess
- **Effort:** S (free flags) · M (`noUncheckedIndexedAccess`; prod fixes must keep behaviour, e.g. a `?? fallback` that
  can't happen, or a narrowing guard) · **Risk:** low · **Benefit:** compile-time safety, no runtime change.

#### A11. ESLint: Prettier runs inside ESLint, and `import/namespace` is redundant with TS

- **Where:** `eslint.config.js:4,8` (`eslint-plugin-prettier/recommended`). The `import/*` rules come from `eslint-config-expo`.
- **Why:** `prettier/prettier` 4.6 s and `import/namespace` 4.1 s out of 21.7 s lint (`TIMING=10`). Prettier
  itself recommends not running it as a lint rule (https://prettier.io/docs/integrating-with-linters). typescript-eslint
  recommends turning off `import/namespace`, `import/named` and `import/default` in TS projects because TS already checks them
  (https://typescript-eslint.io/troubleshooting/typed-linting/performance#eslint-plugin-import).
- **Fix:** drop `eslint-plugin-prettier` (keep `eslint-config-prettier` to switch off the conflicting rules) and add
  `npm run format:check` as a CI step (5.6 s; the script already exists). Set `import/namespace: off` for `**/*.ts(x)`.
  Use `eslint --cache` locally (`"lint": "eslint . --cache"`; add `.eslintcache` to `.gitignore`).
  Formatting stays enforced, and the output is byte-identical.
- **Effort:** S · **Risk:** low · **Benefit:** lint 21.7 s → about 12 s (est.), about 1–2 s with `--cache` on re-runs.
  The lint output is cleaner, because format diffs show up as a prettier diff instead of hundreds of lint errors.

#### A12. CI: no Jest/Metro cache, one serial job, and the deploy workflow repeats every check

- **Where:** `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml:24–31`.
- **Why:** Jest is 106 s in CI vs 25 s locally warm and 67 s locally cold + coverage, so cold transforms dominate. Steps run
  one after another (3 min 36 s). On every push to main, `deploy-pages` runs `npm ci` + lint + typecheck + test again
  (about 3 min of duplicate work).
- **Fix:** (1) `actions/cache` for the Jest cache (`--cacheDirectory .jest-cache`, key = lockfile hash + jest config hash)
  and for the Metro cache before `expo export`. (2) Optionally split into 3 parallel jobs: `lint+typecheck+format`, `test`,
  `export`. Each pays `npm ci` (29 s), but the wall time becomes about max(29 + 106) ≈ 2 min 15 s instead of 3 min 36 s.
  With the cache, test ≈ 60 s and the wall time is about 1.5 min. (3) `deploy-pages`: trigger on `workflow_run` of CI success (or `needs`),
  and drop its own lint/typecheck/test. (4) Keep `--maxWorkers` at the default. GitHub runners have 4 vCPU and Jest
  already uses cores − 1; `--maxWorkers=100%` is a small win at most. Measure it, don't assume.
- **Effort:** S · **Risk:** low (CI only) · **Benefit:** about 1.5–2 min per CI run, about 3 min per main push.

#### A13. Reanimated / worklet details (minor, all low)

- `src/components/useTabPager.ts:143`: `queued.value` is read on the JS thread in a layout effect (a synchronous read
  from the UI runtime on native). This happens once per drag commit, so it's harmless. It could move into the scheduled worklet
  (`scheduleOnUI(() => { const step = queued.value … })`). **Benefit:** negligible. Optional.
- `SlideTransition.tsx:74–81` and `CourtMotion.tsx:173–174` use `sv.value = …`, while the pager uses `.set()`. For
  consistency (and React Compiler friendliness, see https://docs.swmansion.com/react-native-reanimated/docs/core/useSharedValue#react-compiler-support),
  switch to `.set()`. Pure refactor. **Effort:** S · **Risk:** low.
- `usePageStyle` (deps `[index]`), `callReact` / `scheduleOnRN` and `animateTo` are already correct. There are no `runOnJS` hops per frame
  (React hears of a drag once). **No action.**

#### A14. Startup: fonts, hydration, photos (mostly fine)

- `src/lib/fonts.ts:23`: `useFonts(appFonts)` always fetches **both OpenDyslexic files (360 KB) at every start**, even
  with the font off. It never blocks (the spinner only waits when the font is on). Loading them only when enabled
  would show the system font for a moment when the user switches the font on, which is a visible change. **SKIP**
  (could be revisited by deferring to idle).
- Photos (`src/store/photoStore.ts:126–141`): one `getAllKeys` + one `multiGet` at module import, a single `setState`.
  `usePhotoUri` selects one string, so only components whose photo changed re-render. About 30 × 20–40 KB data URIs ≈
  1 MB in memory is fine. `prunePhotos` runs on profile/player/team changes, not on rallies. **No action.**
- Hydration: one AsyncStorage key, one JSON parse (2 ms desktop at 1 MB), migrations only on version change. No
  splash hold (native splash → spinner while hydrating). Changing that would be visible. **No action.**

#### A15. Long lists: don't virtualise

- Roster grid (`RosterTab.tsx`), season boxes, season match list, opponents, stats tables, performance list: all
  `ScrollView` + `map` inside `Screen`'s ScrollView, inside pager pages.
- Realistic sizes are about 15 players, 30–60 matches, ≤ 20 opponents, ≤ 15 performance cards. React Native's own
  guidance is that plain `ScrollView` is fine for short lists (https://reactnative.dev/docs/using-a-listview). Virtualising
  would mean moving each tab into a `FlatList` that owns the scroll. That changes pager page height measurement, nested
  scrolling, web scroll restoration and `NoTabSwipe` behaviour, so it risks visible change. The render cost of a
  60-row list is dominated by A1 (the result computation), not by row count.
- **Verdict: SKIP.**

#### A16. `React.memo` on chips, cards and rows: only where it pays

- `PlayerChip`, `PlayerCard`, `MatchRow` and `PerformanceCard` get inline `onPress` closures from their parents, so `memo`
  would need `useCallback` everywhere for little gain. After A1/A2 each list re-render is a few ms at most.
- **Verdict: SKIP**, except: if profiling after A1 still shows `MatchRow` hot, memoise `matchResultLabel` per match
  (A1 already covers it).

#### A17. Web bundle: other heavy imports

- Reanimated `layoutReanimation` (195 KB min / 24 KB gzip), its CSS-animation modules (47 KB) and the `common/style`
  processors (68 KB) are pulled in by Reanimated's index. The app doesn't use them, but there is no supported way to drop them. **SKIP.**
- `@expo/vector-icons` is imported per family (`@expo/vector-icons/Ionicons`), which is already the efficient form. 37 KB min
  (30 KB glyph map). **No action.**
- `expo-crypto` (10 KB web), used only for `randomUUID` (`src/lib/id.ts`). A `.web.ts` using `crypto.randomUUID()`
  would save 10 KB and produce the same format. **Optional, trivial benefit.**
- Both i18n languages (78 KB min) always load. Lazy-loading German is a visible change (async). **SKIP.**

#### A18. Metro tree shaking: SKIP

Measured −2 to −3 % total JS with the experimental flags plus `experimentalImportSupport` (a scratch copy with a
`metro.config.js`). It's experimental, changes module init order (risk to Reanimated/worklets init) and gains little. **SKIP.**

#### A19. Jest config and `jest.setup.ts` hygiene (fine)

- `jest.setup.ts` (40 lines): AsyncStorage mock, worklets mock, Reanimated init stub, the kept-`useSharedValue` patch
  (#221) and RNGH jestSetup. Clean, with no per-file hacks. The global 30 s timeout is needed for `renderRouter` suites.
- `jest.config.js` `transformIgnorePatterns` lists packages the app doesn't have (`native-base`, `@sentry`,
  `react-native-svg`, `nanoid`). Harmless; trimming it doesn't speed anything up. **Optional tidy-up.**
- Suites are evenly spread (max 3.8 s). No suite needs splitting.

#### A20. `exactOptionalPropertyTypes` / `noPropertyAccessFromIndexSignature`: SKIP

`exactOptionalPropertyTypes`: 74 prod errors in 43 files, many at `updatePlayer(id, { photoId: undefined })`-style
clears, which carry **persisted-data semantics** (undefined vs absent keys survive `JSON.stringify` differently,
and export output must stay byte-identical). The risk isn't worth it. `noPropertyAccessFromIndexSignature`: style only (85 in
`exportSchema.ts` upgrade code).

---

### Ranked recommendation

#### DO (high value, low risk, zero visible change)

1. **A1: identity-memoised domain derivations** (M, low). Biggest win: about 30 ms → 3 ms desktop per point
   (est. 150–300 ms → 15–30 ms on a phone with a 60-match season), and it scales with season length.
2. **A3: stable gesture configs** in `usePagerGesture` / `Blocker` (S, low). Stops RNGH/Reanimated rebuilding
   gestures on every render of every pager.
3. **A2: `SeasonsTab` memo fix** (S, low).
4. **A4: memoised `Stack.Screen` options** (S, low). 3–4 fewer navigator renders per point.
5. **A12: CI caching + deploy dedupe** (S, low). About 1.5–2 min per CI run, about 3 min per main push.
6. **A11: Prettier out of ESLint, `import/namespace` off, `--cache`** (S, low). Lint about 22 s → about 12 s.
7. **A10a: enable the five zero-error tsc flags** (S, none).
8. **A5a: drop zod locales from the web bundle** (S, low-med). −41 KB gzip / −299 KB min of startup JS.
   Prefer **A5b** (zod out of `__common`, −97 KB gzip) if the team accepts rewriting `roster.ts` validation.
9. **A10b: `noUncheckedIndexedAccess`** (M, low). 19 prod fixes, the rest mechanical in tests.
10. A13 `.set()` consistency (S, low). Optional polish.

Suggested order: A12 + A11 + A10a first (tooling, no app code). Then A1 + A2 with benchmarks as tests
(keep `a-work/bench` as a non-CI script). Then A3 + A4, with the Android APK swipe check and the
Playwright touch check from HANDOFF §6. Then A5.

#### SKIP

- **A8** `<Activity>` / freezing hidden pager pages: a neighbour must be visible and current at drag start (#215/#218),
  so hiding or freezing brings back the flicker or shows stale data.
- **`freezeOnBlur`** for stack screens: no effect in Expo Router 58 (forced `false`).
- **A15** list virtualisation: small lists, nested in pager + ScrollView, a high risk of layout/scroll change.
- **A16** blanket `React.memo` / `useCallback`: little gain after A1.
- **A9** persist throttling or storage re-layout: changes crash-safety or stored data. But plan a separate data task for
  AsyncStorage size limits (about 1 MB per season).
- **A14** lazy dyslexia font / splash changes: visible.
- **A17** reanimated layout animations, lazy German strings, **A18** Metro tree shaking: unsupported, visible, or too little gain.
- **A20** `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`.

## Appendix B — architecture, types, tests, accessibility and docs audit

Repo state audited: `main` @ `725e201` (v8.2.0), read-only. Scripts and raw outputs are in
`(audit scratch folder, not kept) b-work/`
(`unused.js`, `casts.js`, `eslint.typed.config.js`, `labels.js`, `check.js`, `i18nkeys.js`, `*.txt`).

> Note: while I worked, an untracked folder `src/domain/__golden__/` (golden export tests, 13 failing) appeared in the
> working tree. It isn't mine and isn't on `main`. I excluded it from every number below. Whoever owns it should
> know that `npx jest src/domain` currently fails in this checkout because of it.

---

### Baseline numbers

| Metric                                                                                | Value                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Non-test source files in `app/` + `src/`                                              | 351 files, 25,386 lines                                                                                                                                                                                                                                |
| Files over 150 lines                                                                  | **22** (list below)                                                                                                                                                                                                                                    |
| …of which components / screens / hooks over 150                                       | 8                                                                                                                                                                                                                                                      |
| …of which domain files over 250                                                       | 7 (plus `src/store/appStore.ts` 259)                                                                                                                                                                                                                   |
| `as` casts (AST count, excluding `as const`)                                          | **prod 76**, test 155                                                                                                                                                                                                                                  |
| `as unknown as`                                                                       | **prod 4** (`dates.ts` ×2, `inert.web.ts` ×2), test 8                                                                                                                                                                                                  |
| Of the prod `as` casts, flagged by `@typescript-eslint/no-unnecessary-type-assertion` | **24** (tests: 30)                                                                                                                                                                                                                                     |
| Non-null `!`                                                                          | prod 0, test 29                                                                                                                                                                                                                                        |
| Suppressions                                                                          | **7**: 5 × `eslint-disable-next-line react-hooks/*` (prod), 1 × `no-require-imports` (test), 1 file-level in `jest.setup.ts`. **0** `ts-ignore` / `ts-expect-error` / `ts-nocheck`. I found no "9 suppressions" figure in HANDOFF, and the code has 7. |
| Exports that nothing references                                                       | 3 (`useShortNames`, `LineupEditor` type, `SchemaMatchesTypes` (intentional)) + `Placeholder` component (referenced only by the `components/index.ts` barrel)                                                                                           |
| Exports used only by tests                                                            | 91, of which **13 prod functions/consts are dead** (not used inside their own module either)                                                                                                                                                           |
| Exports used only inside their own file (could drop `export`)                         | 176 (informational, not worth changing)                                                                                                                                                                                                                |
| Unused i18n keys                                                                      | 6 (EN + DE each)                                                                                                                                                                                                                                       |
| Tests                                                                                 | **110 suites / 1198 tests**, all green (65 s). `src/domain`: 37 suites / 715 tests, **100 %** statements 1695/1695, branches 1206/1206, functions 546/546, lines 1337/1337                                                                             |
| Runtime import cycles in `src/`                                                       | none (DFS over non-type imports)                                                                                                                                                                                                                       |
| Accessible-name pairs checked (visible `label` + `accessibilityLabel`, EN + DE)       | 87 pairs × 2 languages: **30 don't contain the visible text** (WCAG 2.5.3 failure) and **43 contain it but don't start with it** (breaks the project rule)                                                                                             |

**Files over 150 lines** (non-test):
`src/domain/exportSchema.ts` 648 · `seasons.ts` 344 · `liveSet.ts` 339 · `lineupSheet.ts` 334 · `stats.ts` 283 ·
`performance.ts` 280 · `tabMotion.ts` 263 · `src/store/appStore.ts` 259 · `lineupEditing.ts` 245 · `roles.ts` 241 ·
`types.ts` 231 · `presets.ts` 204 · `src/components/Court.tsx` 201 · `CourtMotion.tsx` 191 · `roster.ts` 189 ·
`app/(tabs)/_layout.tsx` 179 · `app/match/[matchId]/index.tsx` 172 · `src/store/photoStore.ts` 171 ·
`src/components/useTabPager.ts` 164 · `src/features/lineup/useLineupDraft.ts` 161 · `src/features/live/LiveSetView.tsx` 160 ·
`src/features/lineup/drag/DragContext.tsx` 160.

---

### 1. Architecture & maintainability

#### B1 — Split `src/domain/exportSchema.ts` (648 lines, four jobs in one file)

- **Where:** `src/domain/exportSchema.ts:42-229` (format + zod + `Same<>`), `:231-310` (build/serialize), `:312-535` (parse, consistency, upgrades), `:537-648` (replace/merge + helpers).
- **Why:** it's the most-edited file on every data-model bump (HANDOFF §6), and the hardest to review. Each version adds to four sections.
- **Best practice:** one module per reason to change (SRP). A barrel keeps the public path stable.
- **Proposed split** (flat in `src/domain/`, which matches current convention):
  | New file                  | Contents (moved as-is)                                                                                                                                                                                                                                                               | ~lines |
  | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
  | `exportFormat.ts`         | `EXPORT_APP_ID`, `EXPORT_SCHEMA_VERSION`, `SUPPORTED_IMPORT_VERSIONS`, `TransferData`, all zod schemas, `exportFileSchema`, `Same`/`Assert`/`SchemaMatchesTypes`                                                                                                                     | 190    |
  | `exportUpgrades.ts`       | `upgradeV1`, `upgradeV4`, `upgradeV5`, `upgradeToCurrent` (exported for `parseImport`), plus the doc comment listing all steps (add v8→v9 to it: it's only inline now, `:499`)                                                                                                       | 75     |
  | `exportConsistency.ts`    | `isConsistent`, `hasDuplicates`                                                                                                                                                                                                                                                      | 90     |
  | `exportMerge.ts`          | `replaceData`, `mergeById`, `MergeResult`, `mergeData`, `keepPhoto`, `keepDescription`                                                                                                                                                                                               | 110    |
  | `exportSchema.ts` (stays) | `buildExport`, `BuildExportOptions`, `slugify`, `exportFileName`, `serializeExport`, `ImportErrorCode`, `ImportSummary`, `ParseImportResult`, `summarize`, `parseImport`; then `export * from './exportFormat'; export * from './exportConsistency'; export * from './exportMerge';` | 170    |
- **Callers stay put:** `src/features/settings/useImport.ts`, `useExport.ts`, `src/store/photoStore.ts` (type only), and 5 test files all import `@/domain/exportSchema`. With the barrel nobody changes. `exportSchema.test.ts` (1187 lines) can be split the same way later, but doesn't have to be.
- **Cycle risk:** low. The sub-modules must import each other directly (`./exportConsistency`), **never** `./exportSchema`. `exportMerge` → `exportConsistency` → `seasons`/`presets`/`pointTags`/`photos`; none of those import export code today. Add a one-line header comment ("don't import the barrel") to each.
- **Also move:** `withoutDanglingPhoto` (`:630`) next to `withoutDescription` in `photos.ts` (same `rest as T` pattern, `photos.ts:71`). `isRecord` (`:351`) goes to the shared helper in B6.
- **Effort** M · **Risk** very low (pure move; 100 % coverage plus the round-trip tests catch mistakes) · **Fix:** a pure move commit, then `git diff --stat` should show only moves.

#### B2 — Split `src/domain/seasons.ts` (344 lines; already sectioned by banners)

- **Where:** banners at `:31` (migration), `:114` (forms), `:210` (lists), `:232` (records), `:285` (merge).
- **Proposed:** `seasonNames.ts` (`SEASON_KINDS`, `MAX_*_LENGTH`, `foldName`, `cleanName`) · `seasonUpgrade.ts` (`upgradeSeasonId`, `upgradeOpponentId`, `upgradeSeasonName`, `upgradeToSeasons`, local `Rec`/`str`) · `seasonForms.ts` (`SeasonFormInput/Field/Error/Result`, `validateSeasonForm`, `OpponentNameError`, `toIso`, `validateOpponentName`, `findOpponentByName`) · `seasonRecords.ts` (`seasonsForTeam`, `opponentsForSeason`, `opponentHasMatches`, `OpponentRecord`, `opponentRecords`; the only one that imports `matchState`) · `seasonMerge.ts` (`alignIncomingByName`, `namesAreUnique`). `seasons.ts` becomes a barrel.
- **Callers (9 prod):** `matchForm.ts`, `exportSchema.ts`, `store/migrations.ts`, `store/selectors.ts`, `app/team/[teamId]/match-new.tsx`, 4 files in `features/seasons|matchForm`. No change with the barrel. Inside the domain, prefer direct imports (`exportFormat` → `./seasonNames`, `exportUpgrades` → `./seasonUpgrade`). That keeps `matchState` out of the export upgrade path.
- **Cycle risk:** `seasonUpgrade`/`seasonForms`/`seasonMerge` need `foldName`/`cleanName`: import them from `./seasonNames`, not from the barrel.
- **Effort** S–M · **Risk** very low.

#### B3 — Split `src/domain/liveSet.ts` (339 lines; `replay()` alone is ~105 lines, `:177-279`)

- **Proposed:**
  - `setScore.ts`: `Score`, `targetPoints`, `other`, `setWinnerOf`, `setPointOf` (`:65-115`). These are pure scoring rules, and `matchState`/`stats` want them without the replay.
  - `subRules.ts`: `MAX_SUBS_PER_SET`, `InvalidSubReason`, `onCourt`, `invalidReason` (`:117-133`), plus the partner/`pairUses` bookkeeping pulled out of `replay()` (`:237-253`) into a small `createSubTracker()` → `{ record(out, in): LiveWarning[] }`. That removes the `pairUses.get(key) as number` cast (`:249`).
  - `liveCourt.ts`: `previewSub`, `LiveCourtView`, `liveCourtView` (`:308-339`).
  - `liveSet.ts` keeps the state/step types, `replay`, `replaySet`, `replaySteps`, `addPoint`, `addSub`, `undo`, and re-exports the rest.
- **Callers:** 11 prod importers of `@/domain/liveSet`, all unchanged with the re-exports.
- **Risk:** low. The sub-rule extraction is the only real logic move; it's covered by liveSet tests (REENTRY/SUB_LIMIT cases). **Effort** M.

#### B4 — Split `src/domain/lineupSheet.ts` (334 lines) and fix two wrong homes

- **Proposed:** `html.ts` (`HTML_ESCAPES`, `escapeHtml`) · `lineupSheetCss.ts` (the 50-line `CSS` template, `:243-292`, which is the only user of `theme/print`) · `lineupSheetResults.ts` (`renderResults`, `hasResults`) · `lineupSheet.ts` (label types, `SHEET_ROWS`, `renderSet`, `renderRoster`, `buildLineupSheetHtml`).
- **Wrong homes:**
  - `durationParts` (`:94`) is imported by UI `src/features/live/MatchSummary.tsx:4` from the print module. Move it to `matchState.ts` (next to `durationOf`) or `dates.ts`.
  - `playerName` (`:119`) is a one-line alias of `fullName`, and `src/features/presets/StartersTab.tsx:39,100` imports it from the print module. Replace with `fullName` and delete the alias.
- **Also:** `lineupSheet.ts:13` imports `'../theme/print'` (relative path, and domain → theme). It's pure constants, so it's acceptable; keep it in `lineupSheetCss.ts` only, using the `@/theme/print` alias.
- **Effort** S · **Risk** very low; the HTML output is pinned by `lineupSheet.test.ts`.

#### B5 — Split `src/domain/tabMotion.ts` (263 lines, three consumers with disjoint needs)

- **Proposed:** `slideMotion.ts` (`SLIDE_*`, `slideDirection`, `slideOffset`, `stepTab`), used by `SlideTransition` · `tabDrag.ts` (`TAB_SWIPE_ACTIVATION`, `TAB_DRAG_*`, `TAB_SETTLE_*`, `TAB_COMMIT_FALLBACK_MS`, `dragOffset`, `dragSide`, `dragPosition`, `releaseVelocity`, `dragCommit`, `settleDuration`), used by `usePagerGesture` · `pagerLayout.ts` (`NO_PAGE`, `pagerWindow`, `pageSlot`, `pageOpacity`, `pageTranslate`, `dragFromTab`, `dragToPosition`, `SlideStart`, `slideStart`), used by `TabPager`, `useTabPager`, `SwipeTabs`. Keep `tabMotion.ts` as a barrel.
- **Caveat:** the file has 14 `'worklet'` directives, and functions called on the UI thread must keep them. Reanimated's Babel plugin handles imported worklets, but this was the hardest-won code in v8.1.1 and nobody has verified it on a phone (HANDOFF §1).
- **Effort** S · **Risk** medium (native-only behaviour that Playwright/Jest can't fully prove) → **SKIP for v8.3**, or do it last with an APK smoke test.

#### B6 — Duplicated "legacy upgrade" plumbing in the store migrations and the export upgrades

- **Where:** `src/store/migrations.ts:31-71` (`v1ToV2`, `v5ToV6`, `v6ToV7`) vs `src/domain/exportSchema.ts:443-482` (`upgradeV1`, `upgradeV4`, `upgradeV5`). The bodies are the same "map over `matches[].sets` and `presets`" shape. `isRecord`/`isRec` is defined 4×: `exportSchema.ts:351`, `seasons.ts:40`, `roles.ts:215`, `migrations.ts:29`.
- **Why:** every new data-model version has to write the same traversal twice; a fix in one copy is easily missed in the other.
- **Fix:** add `src/domain/legacyData.ts` with `isRecord`, `mapSets(raw, fn)`, `mapLineups(raw, fn)` (sets + presets), `addSetLogDefaults`, `addRoleDefaults`. Both migrations and `exportUpgrades.ts` use it. The store keeps its own version gates (store and export versions differ).
- **Effort** S · **Risk** low (migration tests + export upgrade tests v1…v8 exist; the golden files someone is adding would pin it further).

#### B7 — Six copy-pasted modal dialogs

- **Where:** `src/features/roster/components/ConfirmDialog.tsx`, `lineup/PlacementConfirm.tsx`, `live/FormationConfirm.tsx`, `print/PrintChoiceDialog.tsx`, `descriptions/UnlockDialog.tsx`, `presets/PresetNameDialog.tsx`. All six have **byte-identical** `backdrop` and `card` style blocks and the same `<Modal transparent animationType="fade" onRequestClose>` shell.
- **Fix:** `src/components/Dialog.tsx` (`<Dialog visible onClose title testID>{children}</Dialog>` + `useDialogStyles`), and keep each dialog's content and buttons. Same pixels by construction (it's the same style object).
- **Effort** S–M · **Risk** low; the web nested-`role="dialog"` nit (HANDOFF §1) stays as it is, so don't try to fix it in the same PR.

#### B8 — Near-duplicate chip filters, and shared UI living inside `features/roster`

- `src/features/stats/SetFilter.tsx` and `src/features/performance/SetSwitch.tsx` are the same 47 lines. They differ only in the string namespace, testID prefix and whether "All" comes first or last. Make one `SetChipFilter` with props `{ strings, testIDPrefix, allPosition: 'first' | 'last' }`. `SeasonFilter.tsx` is a third variant.
- `src/features/roster/components/` is the de-facto shared UI kit: 40 files outside `roster` import from it (`styles` ×19, `NotFound` ×10, `TextField` ×7, `ChoiceChip` ×7, `ConfirmDialog` ×6, `useConfirm` ×5, `useGoBack` ×4, `ListRow` ×4). Move `ChoiceChip`, `TextField`, `ListRow`, `NotFound`, `ConfirmDialog` (→ B7) to `src/components/`, `useConfirm`/`useGoBack` to `src/hooks/` or `src/components/`, and `styles.ts` (`useFormStyles`/`useListStyles`) to `src/components/formStyles.ts`. Pure path moves; update imports with a codemod (or leave re-export shims in the old files for one version).
- `src/features/roster/components/MatchForm.tsx` is the new-match form. It uses `features/matchForm/*`, but the `matchForm` feature has no `MatchForm`. Move it to `src/features/matchForm/MatchForm.tsx` (caller: `app/team/[teamId]/match-new.tsx:6`).
- `features/matchForm/chipStyles.ts` is fine as it is. It's local to two pickers and has no duplicate elsewhere.
- `parseTeamTab` (`features/team/tabs.ts:7`) and `parseSeasonTab` (`features/seasons/seasonTabs.ts:7`) are the same function. Use a generic `parseTab(TABS, value, fallback)` (removes 4 casts).
- **Effort** M (mostly mechanical) · **Risk** low (no style change). Leave the layout-relevant `Segmented` / `SetupFormationRow` / `SetTabs` / `SetPicker` as they are: they look similar but differ in layout, so merging them risks a visible change. **SKIP** those.

#### B9 — Court row constants defined three times; `pad` four times

- Rows: `src/components/Court.tsx:12-13` (`FRONT_ROW [4,3,2]`, `BACK_ROW [5,6,1]`), `src/domain/lineupSheet.ts:100-103` (`SHEET_ROWS`), and `src/domain/rotation.ts:18-19` (`FRONT_ROW_POSITIONS`/`BACK_ROW_POSITIONS`, in a different order). Add `COURT_ROWS` (display order) to `rotation.ts` and import it in both places.
- `pad`: `dates.ts:7` (`pad2`), `exportSchema.ts:301`, `roster.ts:51`, `matchSearch.ts:17`. Export `pad2` from `dates.ts`. (The `roster.ts` copy disappears with B12.)
- `POINT_KINDS` (`exportSchema.ts:63`) re-lists `PointKind`. `pointTags.ts:17-19` has `US_POINT_KINDS`/`THEM_POINT_KINDS`. Put `POINT_KINDS` in `types.ts` next to `ERROR_TYPES`.
- **Effort** S · **Risk** none.

#### B10 — Components and screens over ~150 lines

| File                                       | Lines | Proposed split                                                                                                                                                                                         |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/Court.tsx`                 | 201   | Move `splitPadding`/`flat`/`PADDING_KEYS` (`:41-67`) to `src/components/courtStyle.ts`; extract the per-slot JSX (`:88-133`) into a `CourtSlot` component.                                             |
| `src/components/CourtMotion.tsx`           | 191   | `useCourtMotion` + `slotRect` (`:35-90`) → `useCourtMotion.ts`; `CourtGhosts` + `Ghost` stay.                                                                                                          |
| `app/(tabs)/_layout.tsx`                   | 179   | Screen holds logic (CLAUDE.md: screens are thin). Move `TabIcon`, `APP_TABS`, `useShownTab`, `AppTabPagerContext`, `TabScene` (`:21-90`) to `src/features/appTabs/` (or `src/components/AppTabs.tsx`). |
| `app/match/[matchId]/index.tsx`            | 172   | Extract the 5 link buttons (`:65-125`) into `src/features/lineup/MatchLinks.tsx` (this also gives one place for the a11y label fix, B25).                                                              |
| `src/components/useTabPager.ts`            | 164   | Leave it (tightly coupled shared values; same device-risk argument as B5).                                                                                                                             |
| `src/features/lineup/useLineupDraft.ts`    | 161   | Pending-confirmation state (`PendingKind`, confirm/cancel) → `usePendingPlacement.ts`.                                                                                                                 |
| `src/features/live/LiveSetView.tsx`        | 160   | Borderline; extract the banners + scoreboard header block if touched anyway. Otherwise leave it.                                                                                                       |
| `src/features/lineup/drag/DragContext.tsx` | 160   | `DragApi` types + `useDrag` → `dragTypes.ts`; leave the provider.                                                                                                                                      |

- **Effort** M overall · **Risk** low if each is a pure extract (same JSX tree). The live screen has a height budget (HANDOFF §6), so don't add wrappers there.

#### B11 — Other large domain/store files (keep, or light touch)

- `stats.ts` 283 / `performance.ts` 280: `performance.ts:187-280` ("derived numbers": `plusMinus`, `netPoints`, `rating`, the rates, `compareByPerformance`, `performanceRows`) → `performanceRates.ts`. `stats.ts` is fine.
- `appStore.ts` 259: a Zustand slice split (profiles/teams · matches/presets · seasons · device settings) is possible, but it touches persistence and the store's `partialize`/migrate wiring. **SKIP** for v8.3.
- `lineupEditing.ts` 245, `roles.ts` 241, `types.ts` 231, `presets.ts` 204, `roster.ts` 189: below the threshold or cohesive. `roster.ts` shrinks with B12.

#### B12 — Dead code (not used by app code and not even inside its own module)

Script: `b-work/unused.js` (regex over exports, whole-word search in other non-test files). Verified by hand:

| Export                                                                                        | File:line                                                                           | Status / action                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useShortNames`                                                                               | `src/store/hooks.ts:43`                                                             | No importer at all (HANDOFF already lists it). Delete.                                                                                                                                                                 |
| `LineupEditor` (type)                                                                         | `src/features/lineup/useLineupEditor.ts:27`                                         | No importer. Delete.                                                                                                                                                                                                   |
| `Placeholder` component + `t.placeholder.comingSoon`                                          | `src/components/Placeholder.tsx`, `components/index.ts:3`, `i18n/en.ts:88`, `de.ts` | Only in the barrel; the v1 stub screen is gone. Delete the component, the barrel line and the i18n keys.                                                                                                               |
| `validateMatchForm`, `MatchFormInput`, `MatchFormField`, `toIsoDate`, `isValidIsoDate`, `pad` | `src/domain/roster.ts:51-65, 172-189`                                               | The pre-v7 match form, superseded by `matchForm.ts` + `dates.ts`. Test-only. Delete them with their tests in `roster.test.ts` (the tests cover dead code, so deleting them doesn't weaken anything; say so in the PR). |
| `removeFromCourt`                                                                             | `lineupEditing.ts`                                                                  | Test-only. Delete or keep as API (decide).                                                                                                                                                                             |
| `lastPlayedSetNumber`                                                                         | `matchState.ts`                                                                     | Test-only (still listed in WORKER_BRIEF). Delete.                                                                                                                                                                      |
| `COURT_ROLES`, `primaryPosition`                                                              | `roles.ts`                                                                          | Test-only. Delete.                                                                                                                                                                                                     |
| `getAllRotations`, `isBackRow`, `oppositePosition`                                            | `rotation.ts`                                                                       | Test-only. **Keep**: `VOLLEYBALL_RULES.md:245` cites `oppositePosition` as the PASS evidence for rule 4, and rotation tests are required by CLAUDE.md. Add a comment "kept as rule evidence".                          |
| `removePhoto`                                                                                 | `src/store/photoStore.ts:67`                                                        | Test-only. Delete, or mark `/** @internal test helper */`.                                                                                                                                                             |
| `SEASON_MAX_LENGTH` + `teamSchema.season`                                                     | `roster.ts:12, 110-115`                                                             | The team season field is hidden since v7, but `TeamForm` still validates the kept value. Keep (behaviour).                                                                                                             |

- **Unused i18n keys** (`b-work/i18nkeys.js`, verified): `roster.teams.seasonPlaceholder`, `roster.team.rosterTab`, `roster.team.matchesTab` (only `rosterFlow.test.tsx:223` uses it; switch to `t.presets.nav.matches`), `lineup.errorsHeading`, `lineup.warningsHeading`, `placeholder.comingSoon`. Delete in EN + DE. The German type forces both.
- **Effort** S · **Risk** none (no UI path reaches them). The `src/domain` 100 % coverage gate stays satisfied, because the tests go with the code.

#### B13 — Stale comments and docs inside code

- `exportSchema.ts:234` `BuildExportOptions.teamId` says "profile, players, matches and presets" (it also takes seasons, opponents, photos). `mergeData` doc `:564` says "every profile, team, player, match and preset is matched by id" (also seasons, opponents, photos). The `upgradeToCurrent` doc (`:484-490`) stops at v7 → v8.
- `src/features/roster/components/TeamForm.tsx:30` is correct. `WORKER_BRIEF` lists `lastPlayedSetNumber` (dead, B12).
- **Effort** S · **Risk** none.

#### B14 — i18n structure and naming

- `src/i18n/en.ts` mixes inline sections (`app`, `common`, `nav`, `positions`, `court`, `player`, `placeholder`, lines 29-90) with 20 per-feature files. Move the inline ones to `en/common.ts` (same for DE) so `en.ts`/`de.ts` become pure assembly.
- Namespaces don't follow features: the team nav labels live in `t.presets.nav.*`, season match rows use `t.roster.matches.*`, and the stats season filter uses `t.roster.seasonLabel`/`t.roster.seasonKind`. Renaming keys is churn across many tests, so only document it (a header comment per file), **don't rename** in v8.3.
- CLAUDE.md "src/i18n/en.ts — All user-facing strings" is outdated (now `en/*.ts` + `de/*.ts`).
- **Effort** S · **Risk** none.

#### B15 — Folder layout vs CLAUDE.md

- Not in CLAUDE.md: `__fixtures__/` folders (`features/presets/__fixtures__/team.ts` is used by lineup and matchForm tests; `features/rotation/__fixtures__/seed.ts`), the test helper `src/store/testSeason.ts` living among prod store files, the `roster/components` + `roster/hooks` sub-folders (every other feature is flat), and `features/rotation/index.ts` as the only feature barrel.
- **Fix:** create `src/test-utils/` (see B21) and move `testSeason.ts` and the two fixtures there. Document `__tests__` / `test-utils` in CLAUDE.md.
- **Effort** S · **Risk** none.

---

### 2. Type safety

#### B16 — 24 prod `as` casts are unnecessary (typed lint proves it)

- `noUncheckedIndexedAccess` is **off** (`tsconfig.json` sets `strict` only, and `expo/tsconfig.base` doesn't add it). So `arr[i] as string` and `record[id] as X` assert what the type already says.
- **List** (`@typescript-eslint/no-unnecessary-type-assertion`, config in `b-work/eslint.typed.config.js`): `Court.tsx:63` ×2 · `CourtMotion.tsx:67` · `SwipeTabs.tsx:69,74` · `dates.ts:60` · `matchSearch.ts:27,32,33,40` ×2 · `performance.ts:107,275` · `playerNames.ts:36` · `roles.ts:70,177,186` · `seasons.ts:56` · `stats.ts:156,159,201,282` · `teamAvatar.ts:27`. Tests: 30 more.
- **Fix:** remove them, then add the rule to `eslint.config.js` with type info (`parserOptions.projectService`). That makes `npm run lint` slower (~+60 s here). Alternatively run it once and don't enforce it.
- **Better long-term:** turn on `noUncheckedIndexedAccess`. That makes these casts _meaningful_ (they'd become `?? fallback` or real guards), but it produces many new errors. **SKIP** in v8.3 and note it for later.
- **Effort** S · **Risk** none (types only, no emitted-JS change).

#### B17 — The remaining casts and how to remove them

| Cast                                                                          | Where                                                                                                                                                                                 | Removable?                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `z.enum(X as [T, ...T[]])` ×5                                                 | `exportSchema.ts:61,119,120,144,159`                                                                                                                                                  | Yes. Declare the const lists as tuples: `export const ALL_POSITIONS = ['S','OH',…] as const satisfies readonly Position[]` (same for `ERROR_TYPES`, `FORMATION_SYSTEMS`, `FORMATION_ORDERS`, `SEASON_KINDS`). zod 4.6 accepts readonly tuples. Watch the `.includes(x)` call sites that pass a wider type (they need `(LIST as readonly string[])`, which already exists in some places). |
| `match as unknown as [string,string,string,string]` ×2                        | `dates.ts:29,85`                                                                                                                                                                      | Yes. Use named groups: `/^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})/` and `match.groups`, or destructure (`const [, y = '', m = '', d = ''] = match`).                                                                                                                                                                                                                                          |
| `view as unknown as HTMLElement \| null` ×2                                   | `src/lib/inert.web.ts:9,15`                                                                                                                                                           | Keep. It's the documented RN-web "View is its DOM node" bridge. Write it once as `asDomNode(view)` in that file with a comment.                                                                                                                                                                                                                                                           |
| arithmetic `as CourtPosition` / `as RotationNumber` / `as SetNumber` ×13      | `rotation.ts:34,43,84,89`, `roles.ts:132,208,210`, `courtMotion.ts:20`, `formationSteps.ts:17`, `liveSet.ts:165`, `matchFlow.ts:42,45,60`, `lineupEditing.ts:244`, `matchState.ts:96` | Unavoidable for numeric literal unions. Centralise as `toCourtPosition(n)` / `toSetNumber(n)` helpers in `rotation.ts`/`types.ts` (one cast each, unit-tested).                                                                                                                                                                                                                           |
| `roles.ts:177` `as CourtPosition as RotationNumber`                           |                                                                                                                                                                                       | Double cast. `RotationNumber` and `CourtPosition` are both `1..6`, so `as RotationNumber` alone is enough (lint flags the inner one).                                                                                                                                                                                                                                                     |
| `{} as Record<CourtPosition, Position>`                                       | `roles.ts:75`                                                                                                                                                                         | Yes. Build it with `Object.fromEntries(COURT_POSITIONS.map(...))` through a typed helper, or initialise all six keys.                                                                                                                                                                                                                                                                     |
| `performance.ts:66` `Object.fromEntries(...) as Record<…>`                    |                                                                                                                                                                                       | Same helper as above (`recordOf(keys, fn)`).                                                                                                                                                                                                                                                                                                                                              |
| `Object.keys(line) as (keyof X)[]`                                            | `stats.ts:211`, `performance.ts:91`                                                                                                                                                   | Keep (standard TS idiom), or add a typed `keysOf()` helper.                                                                                                                                                                                                                                                                                                                               |
| `rest as T`                                                                   | `exportSchema.ts:633`, `photos.ts:71`                                                                                                                                                 | Keep (omit-from-generic idiom). Merge into one `omitKey(item, 'photoId')` helper in `photos.ts`.                                                                                                                                                                                                                                                                                          |
| `liveSet.ts:249 pairUses.get(key) as number`, `:261 position as number`       |                                                                                                                                                                                       | Removed by the B3 sub-tracker (`?? 0`; `position` is `CourtPosition \| undefined`, so guard it).                                                                                                                                                                                                                                                                                          |
| `stats.ts:159 slots[p] as string`, `:186 set.liberoId as string`              |                                                                                                                                                                                       | Use type-guarded locals (`const id = slots[p]; if (id !== null) …`).                                                                                                                                                                                                                                                                                                                      |
| `errorTagging.ts:22`, `lastRally.ts:52` `arr[len-1] as X`                     |                                                                                                                                                                                       | `.at(-1)` with a guard (needs `lib` ES2022; `ESNext` already includes it).                                                                                                                                                                                                                                                                                                                |
| `matchForm.ts:82 result.errors.name as SeasonFormError`                       |                                                                                                                                                                                       | Yes, if `validateSeasonForm`'s error map is typed per field (`Partial<Record<SeasonFormField, SeasonFormError>>`, which it nearly is).                                                                                                                                                                                                                                                    |
| `roster.ts:76-77 as K / as FieldErrorCode`                                    |                                                                                                                                                                                       | Keep (zod issue → our codes). One comment.                                                                                                                                                                                                                                                                                                                                                |
| `parseTeamTab`/`parseSeasonTab` ×4                                            | `team/tabs.ts:9`, `seasons/seasonTabs.ts:9`                                                                                                                                           | Use a generic type-guard `isOneOf(list, v): v is T` (B8).                                                                                                                                                                                                                                                                                                                                 |
| `app/(tabs)/_layout.tsx:53,57`, `app/_layout.tsx:72`, `lib/parentRoute.ts:61` |                                                                                                                                                                                       | `useSegments() as string[]` and `route.params as Record` are expo-router typing gaps; keep with a comment. `parentRoute.ts:61` has a redundant second `str()` call: assign it to a `const set = str(params?.set)` and the cast goes away.                                                                                                                                                 |
| `usePagerGesture.ts:108 as PanConfig`, `SwipeTabs.tsx:131 as NativeConfig`    |                                                                                                                                                                                       | Keep. The comment already explains it (web-only RNGH props not in the type).                                                                                                                                                                                                                                                                                                              |
| `theme.ts:106,119`                                                            |                                                                                                                                                                                       | Keep (generic style-sheet transform).                                                                                                                                                                                                                                                                                                                                                     |
| `photoStore.ts:39 as [string,string]`                                         |                                                                                                                                                                                       | Use `satisfies` or an explicit tuple return type.                                                                                                                                                                                                                                                                                                                                         |

- **Effort** M · **Risk** none (types only). Do it per file with the domain tests as the safety net.

#### B18 — Suppressions (7) — each one

| Where                                                           | Rule                              | Removable?                                                                                                                   |
| --------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/components/CourtMotion.tsx:128`                            | `react-hooks/set-state-in-effect` | Keep (measured layout from outside React; the comment explains it).                                                          |
| `src/components/CourtMotion.tsx:134`                            | `exhaustive-deps`                 | Possibly: wrap `done` in a ref (`useEffectEvent`-style `latest` ref). Then deps are `[token, moves]` honestly. Medium value. |
| `src/components/SlideTransition.tsx:83`                         | `exhaustive-deps`                 | Same ref pattern (`widthRef`). Keep if unsure: animation code that hasn't been checked on a device.                          |
| `src/features/roster/hooks/useStartupRedirect.ts:34`            | `exhaustive-deps`                 | Yes: deps `[hasProfile, router]` give the same behaviour because of the module-level `startupHandled` guard.                 |
| `src/features/lineup/drag/useDropZone.ts:28`                    | `exhaustive-deps`                 | Keep (key-based memo, documented). Or `useMemo(() => target, [key])` first.                                                  |
| `src/features/descriptions/__tests__/descriptions.test.tsx:198` | `no-require-imports`              | Yes: `jest.isolateModules` + `await import()`, or a top-level import with `jest.resetModules`.                               |
| `jest.setup.ts:1` (file)                                        | `no-require-imports`              | Keep (jest.mock factories).                                                                                                  |

- **Effort** S · **Risk** low (behaviour-preserving deps). Re-run the slide/pager tests.

#### B19 — `Same<>` zod ↔ type guards: complete

- `exportSchema.ts:217-229` guards profile, team, player, setLineup, the event union, match, preset, photo, season, opponent, and the whole file. `formationSchema` and `slotsSchema` are covered transitively through `SetLineup`/`LineupPreset`. `POINT_KINDS` `satisfies` only checks a subset, but the `SetEvent` guard catches a missing kind (the other direction fails).
- **Gaps (minor):** `TransferData` is derived from `ExportFile`, so it's fine. `SUPPORTED_IMPORT_VERSIONS: readonly number[]` could be derived (`Array.from({length: EXPORT_SCHEMA_VERSION}, (_, i) => i + 1)`), so a version bump can't forget it. **Effort** S · **Risk** none.

#### B20 — Loose types

- `Stats.players: Record<string, PlayerStats>` (`stats.ts:76`) and `Performance.players` cause the `as PlayerStats` casts. Make it `Partial<Record<string, …>>` (honest) or a `Map`. Changing it touches stats UI → **SKIP**; B16 already removes the casts.
- `ManagerProfile.color: string` (`types.ts:20`): the profile colours are a palette (`profileColors`). It's persisted, and imports allow any string, so keep `string`.
- `roles.ts:197 overrides: Record<string, string>`: legacy v5 upgrade input, fine.
- i18n functions take `kind: string`, `position: string` where `PointKind`/`Position` names are passed after translation. That's fine.
- Optional fields that are always set: none found in `types.ts`. `Team.season?` is legacy, `photoId?`/`description?` are really optional, and `Opponent`/`Season` match the schema guards.

---

### 3. Tests

#### B21 — Duplicated store-seeding helpers (20 local `seed()` functions)

- Each of `live/__tests__/{ErrorTypes,PointTags,RolesLive,WholeMatch,LiveMatch,FormationRules,LivePerformanceTab}`, `lineup/__tests__/*`, `stats`, `profile`, `seasons`, `settings`, `descriptions`, `performance`, `rotation/setterRotation`… builds the same profile `prof1` / team `team1` / match `m1` with `seasonId: 's1', opponentId: 'o1'` **without creating the season/opponent**. The seeded state is therefore inconsistent (it would fail `isConsistent`), and the tests quietly depend on the UI tolerating it.
- Counts: `renderRouter(` in 44 test files, `hydrated: true` in 35, `resetAll()` in 38, `usePhotoStore.setState`/`resetPhotoStoreForTests` in 12, `seasonRefs(` in 8.
- **Fix:** `src/test-utils/` with `seedApp({ players, sets, … })` (creates real season + opponent through `seasonRefs`), `makeSet(overrides)`, `makeMatch(overrides)`, `renderApp(route, seed?)` (hydrated + `renderRouter`), `resetStores()` (app + photo store). Migrate file by file. Test expectations don't change.
- **Effort** M–L (many files) · **Risk** low for the app; for the tests, keep the assertions untouched (CLAUDE.md "never weaken a test").

#### B22 — Pager duplicates and hidden elements

- I found no `getAllBy…()[0]` workarounds. The pager hides off-screen pages with `aria-hidden` / `accessibilityElementsHidden` / `importantForAccessibility="no-hide-descendants"` (`src/components/TabPager.tsx:49-55`), so default RNTL queries only see the shown page. That's good.
- Six files define their own `const hidden = { includeHiddenElements: true }` (`RoleTag`, `CourtMotion` (`all`), `stats`, `formation`, `roles` (helper), `photoChips`/`teamPhoto`/`playerPhoto`). Export one `includeHidden` from `src/test-utils`.
- The known gap "sliding rotation copies repeat the spots' test IDs for ~290 ms" (HANDOFF §1) hasn't caused test workarounds. No action.

#### B23 — Mock hygiene

- `jest.setup.ts` is tidy (AsyncStorage, worklets, Reanimated init stub, kept `useSharedValue`, RNGH). 3 files re-mock Reanimated by spreading the mock to spy on `useReducedMotion`/`withTiming`/`withSequence` (`components/__tests__/TabPager.test.tsx:15`, `SwipeTabs.test.tsx:11`, `CourtMotion.test.tsx:9`). That's legitimate, but contrary to the HANDOFF §6 wording "don't add per-file hacks". Instead, make `useReducedMotion` a `jest.fn` in `jest.setup.ts` and expose `withTiming`/`withSequence` as spies. Then the 3 per-file mocks go away.
- `as jest.Mock` casts on imported mocks (those 3 files and others) → `jest.mocked(fn)`.
- Platform mocks (`@/lib/fileTransfer`, `@/lib/pickPhoto`, `@/lib/print`, `expo-*`) are per-file and scoped. Fine.
- **Effort** S · **Risk** low.

#### B24 — Every feature folder has tests; domain 100 % (confirmed)

- All 16 `src/features/*` folders have `__tests__` with RNTL component tests. `npx jest --coverage src/domain` → 100/100/100/100 (37 suites, 715 tests). That 100 % includes the dead code in B12, so coverage hides dead exports. Pair the gate with the unused-export script (B29).
- Largest test files: `exportSchema.test.ts` 1187, `appStore.test.ts` 678, `lineupSheet.test.ts` 574. Split `exportSchema.test.ts` along B1 if B1 is done (optional).
- Test files query by hard-coded EN accessible names in many places (e.g. `rotation/__tests__/RotationViewer.test.tsx:38-90` `'Next rotation'`/`'Show rotation 4'`, `components/__tests__/shared.test.tsx:44,62,125` `'Number 7, Ana Ace, Setter'`, `live/__tests__/RolesLive.test.tsx:126-129` `/^Rotate ↺/`, `rotation/__tests__/StartersOverview.test.tsx:14-52`). Prefer `t.*` lookups so string edits don't break them. That matters for B25.

---

### 4. Accessibility debt (WCAG 2.5.3 Label in Name)

Method: `b-work/check.js` evaluates every element that has both a visible `label` and an `accessibilityLabel` (87 pairs, found by AST in `b-work/pairs.js`) in EN and DE with sample arguments. Symbols (‹ › ↺ ↻ ✕) are ignored. "MISSING" = the label doesn't even contain the visible text (a real 2.5.3 failure, https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html). "CONTAINS" = it contains the text but doesn't start with it (the project rule, HANDOFF §6).

**Important for v8.3 scope:** these are user-facing strings (screen-reader output, EN + DE). Changing them isn't "zero visible change" in pixels, but it _is_ a text change. Ship it as its own PR (`fix/a11y-label-in-name`) with owner sign-off, or move it to v8.4.

#### B25 — The HANDOFF §1 list, item by item

| Item                    | File:line (component · i18n)                                                                                | Visible EN / DE                                               | Current label EN / DE                                                                                                                                                                                                                                                                               | Proposed label EN / DE                                                                                                                                                                                                                                                                                                    | Tests that query it                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Roster rows (now cards) | `features/roster/components/PlayerCard.tsx:44` · `i18n/en/roster.ts:63`, `de/roster.ts`                     | name                                                          | "Anna Meier, number 7, …. Open details"                                                                                                                                                                                                                                                             | **Already fixed in v8** (starts with the name). Remove from HANDOFF.                                                                                                                                                                                                                                                      | —                                                                                                          |
| Active / Injured toggle | `PlayerCard.tsx:85` · `en/roster.ts:60-61`                                                                  | "Active" / "Injured"                                          | "Active: Anna. Mark as injured or inactive"                                                                                                                                                                                                                                                         | **Already fixed in v8.** Remove from HANDOFF.                                                                                                                                                                                                                                                                             | —                                                                                                          |
| Point us / them         | `features/live/PointButtons.tsx:48-49` · `en/live.ts:18-21`, `de/live.ts:21-24`                             | "Point us" / "Punkt für uns"; "Point them" / "Punkt Gegner"   | "We won the rally" / "Wir haben den Ballwechsel gewonnen"; "Lions won the rally" / "Lions hat den Ballwechsel gewonnen" — **MISSING** in both                                                                                                                                                       | "Point us: we won the rally" / "Punkt für uns: wir haben den Ballwechsel gewonnen"; "Point them: Lions won the rally" / "Punkt Gegner: Lions hat den Ballwechsel gewonnen"                                                                                                                                                | via `t.live.pointUsLabel` (follow automatically)                                                           |
| Tag kind chips          | `features/live/PointTagRow.tsx:69-74`, `TagPlayerPicker.tsx:56-58` · `en/tags.ts:64-65`, `de/tags.ts:61-62` | "Kill" / "Angriff"                                            | "Tag the last point as Kill" / "Letzten Punkt markieren als Angriff"; "Remove the tag Kill" / "Markierung Angriff entfernen"                                                                                                                                                                        | "Kill: tag the last point" / "Angriff: letzten Punkt so markieren"; "Kill: remove the tag" / "Angriff: Markierung entfernen"                                                                                                                                                                                              | `PointTags.test.tsx`, `ErrorTypes.test.tsx` (check for literals)                                           |
| Tag player chips        | `TagPlayerPicker.tsx:88-93` · `en/tags.ts:67-68`, `de/tags.ts:64-65`                                        | "#7"                                                          | choose "#7 Anna Meier: Kill" (OK); clear "Remove #7 Anna Meier from the tag" / "#7 Anna Meier aus der Markierung entfernen" (EN contains only)                                                                                                                                                      | EN clear: "#7 Anna Meier: remove from the tag"                                                                                                                                                                                                                                                                            | same                                                                                                       |
| Error-type chips        | `ErrorTypeChips.tsx:33,54`                                                                                  | type                                                          | `chooseErrorType`/`clearErrorType`                                                                                                                                                                                                                                                                  | pass (start with type)                                                                                                                                                                                                                                                                                                    | —                                                                                                          |
| Match links             | `app/match/[matchId]/index.tsx:66-118` · `en/lineup.ts:35-38`, `en/live.ts:4-5`, `en/stats.ts:85-86` (+ DE) | "Rotation", "Live", "Stats" / "Rotation", "Live", "Statistik" | EN "Open the rotation viewer for this set", "Open live match mode at the current set", "Open the statistics of this match" (Stats: **MISSING**); DE "Rotationsansicht für diesen Satz öffnen" (contains), "Live-Modus beim aktuellen Satz öffnen" (contains), "Statistik dieses Spiels öffnen" (OK) | "Rotation: open the rotation viewer for this set" / "Rotation: Rotationsansicht für diesen Satz öffnen"; "Live: open live match mode at the current set" / "Live: Live-Modus beim aktuellen Satz öffnen"; "Stats: open the statistics of this match" (DE already OK). Starters + Performance already follow this pattern. | `navigation.test.tsx`/others use testIDs `open-*` (safe)                                                   |
| DE Profile tab          | `features/profile/ProfileCard.tsx:62`, `ProfileScreen.tsx:50` · `de/profile.ts:19,27`                       | "Profil bearbeiten", "Profil löschen"                         | "Profil Coach bearbeiten", "Profil Coach löschen" (**MISSING**)                                                                                                                                                                                                                                     | "Profil bearbeiten: Coach", "Profil löschen: Coach" (the DE seasons strings already use the "Bearbeiten: Saison X" pattern)                                                                                                                                                                                               | `profileFlow.test.tsx:84-149`, `profilePhoto.test.tsx:85,94` via `p.editLabel(...)` (follow automatically) |
| DE app tab bar          | `app/(tabs)/_layout.tsx:143,153,165` · `de/profile.ts:11-13`                                                | "Teams", "Profil", "Einstellungen"                            | "Tab Teams", "Tab Profil", "Tab Einstellungen" (contains)                                                                                                                                                                                                                                           | "Teams-Tab", "Profil-Tab", "Einstellungen-Tab"                                                                                                                                                                                                                                                                            | `language.test.tsx:38-53` via `de.profile.tabs.*` (follow)                                                 |

#### B26 — Other failures found by the sweep (not in HANDOFF)

**MISSING (label doesn't contain the visible text): 30**

- EN + DE: `LiberoReplaces.tsx:49` ("Suggest middles" → "Suggest the middle blockers on court"), `PresetApply.tsx:102` and `TemplateFill.tsx:68` (Cancel → "Close the … list/choice"), `MatchSummary.tsx:77` ("Back to match" → "Back to the match screen"), `NextSetSetup.tsx:95` ("Edit lineup" → "Edit this set in the lineup builder"), `NextSetSetup.tsx:109` ("Undo last point" → "Undo the last point of set N…"), `StartersTab.tsx:58,85` ("Set starters"/"Edit starters" → "Set/Edit the team's starters"), PointButtons (above).
- EN only: `ExportSection.tsx:41` ("Export Herren 1" → "Export only the team Herren 1"), `SetupSourceButtons.tsx:38` ("Copy set 1" → "Copy the lineup of set 1"), Match link Stats.
- DE only: `MatchSummary.tsx:83`, `SetWonPanel.tsx:60`, `UndoActions.tsx:43` (visible "Letzten Punkt zurücknehmen"/"Rückgängig", label "Letzten Punkt für uns zurücknehmen"), `SetFilter.tsx:22` ("Alle Sätze" → "Statistik aller Sätze"), `RotationStepper.tsx:57` ("Weiter ›" → "Nächste Rotation"), DE profile edit/delete (above).

**CONTAINS but doesn't start with it: 43.** Mostly DE "verb at the end" (`Vorlage Alpha umbenennen`, `Team Herren 1 löschen`, `Profil Coach öffnen`) and EN "Open team X" / "Open profile X" (`TeamList.tsx:75`, `ProfilePicker.tsx:80`), `PlayerChip` "Number 7, Anna…" (visible "7"; `src/i18n/en.ts:84`), `RotationStepper` "Show rotation S1", `SetSwitch`/`SetFilter` "Stats of set 1", `SetupSourceButtons` "Fill this set with…". The full list is in `b-work/check.js` output (re-run: `node b-work/check.js`).

- **Pattern fix:** "`<visible text>`: `<extra context>`" in both languages (DE: "Löschen: Team Herren 1", as `seasons.*` already does).
- **Test impact:** tests that use `t.*Label(...)` follow automatically. Tests with literals need edits. Known so far: `RotationViewer.test.tsx` (5×), `formationRoles.test.tsx:10`, `shared.test.tsx` (3×), `StartersOverview.test.tsx` (4×), `presetsFlow.test.tsx:103`, `liberoTemplates.test.tsx:112-142`. Grep for `name: '` / `LabelText('` before changing a string.
- **Guard:** add a unit test that walks the same visible/label pairs (port `b-work/check.js` into `src/i18n/labelInName.test.ts`), so regressions fail CI.
- **Effort** M (strings + tests, EN + DE) · **Risk** text change for screen-reader users (no pixels). Needs owner OK under the "zero change" rule.

---

### 5. Docs

#### B27 — `docs/WORKER_BRIEF.md` is v3-era and now misleading

What's outdated (line refs to `docs/WORKER_BRIEF.md`):

- `:3` "Current state: v3 (app 3.0.0)" → 8.2.0. `:7` PLAN §15–17, DECISIONS #88–93 → "the current version's PLAN section + decisions touching your files".
- `:15` data model v4 / store 4 / export 4 → store **10**, export **9**. Seasons, opponents, photos, formations and themes are all missing.
- `:16-21` domain list misses `roles`, `placementCheck`, `formationChange`, `liberoRoles`, `rotationNames`, `performance`, `errorTagging`, `photos`, `photoCrop`, `seasons`, `matchForm`, `statsSeason`, `dates`, `playerNames`, `rosterGrid`, `teamAvatar`, `tabMotion`, `courtMotion`, `matchSearch`. It lists the dead `lastPlayedSetNumber`.
- `:22` store fields miss `seasons`, `opponents`, `chipLabel`, `themeMode`, `dyslexiaFont`; the hooks list is partial; `photoStore` is absent.
- `:23` components list misses `RoleTag`, `OffPositionMark`, `Photo`, `TeamAvatar`, `SlideTransition`, `SwipeTabs`/`TabPager`/`PagerScene`, `HeaderTitle` usage.
- `:24` **theme is wrong for v8**: "`colors` … Text on orange/yellow is `colors.onPrimary`". A worker following it would write static colours that don't follow light/dark or the dyslexia font. It must say `makeStyles((theme) => …)` / `useTheme()`, the token rules, and "no colour literals (test-enforced)".
- `:25` platform list misses `pickPhoto`, `unlock`, `inert`, `themeColor`, `cancelPress`.
- `:35` routes miss `players/[playerId]`, `performance`, `season/[seasonId]`, `season-new`, `?seasonId=`.
- Testing notes miss: photo store seeding order, `seasonRefs`, `includeHiddenElements` for pager pages, the Reanimated mock notes, hard-coded label literals (B24).
- Rules miss: WCAG 2.5.3 label-in-name, `makeStyles` + `theme` param name, dyslexia-font check at 375 px DE, the live screen height budget, the exact PR footer, no URL params with "%" ids.
- DoD browser matrix misses dark/light and the font.

**Rewrite outline** (keep it short and version-agnostic, and point to HANDOFF §3 for the architecture so it can't drift again):

1. _Purpose & reading order_: CLAUDE.md → HANDOFF §3/§6 → PLAN (current version section) → DECISIONS touching your files.
2. _Setup_: worktree branch from `origin/main`, `npm ci`, `EXPO_OFFLINE=1 npx expo install`, unique local branch names.
3. _Binding rules checklist_: theme (`makeStyles`/`useTheme`, tokens), i18n (`useT`, EN+DE, typed DE, no `@/i18n/en` import), a11y (labels start with visible text, `aria-*` on web, 44 px, tap alternative), dialogs (`Dialog`/Modal, no `Alert`), Zustand `useShallow`, persisted-shape changes (orchestrator only), platform files, live-screen height.
4. _Where things live_: one paragraph plus a pointer to HANDOFF §3 (no lists of modules).
5. _Testing recipes_: RNTL v14 async, `renderRouter` + hydrated, `src/test-utils` seeders (B21), photo store order, hidden pager pages, query by `t.*` not literals, no per-file Reanimated mocks.
6. _Definition of done_: lint/typecheck/test --coverage/web export; Playwright 375 + 1280, EN + DE, dark + light, dyslexia font on at 375 DE; screenshots in your scratchpad subfolder.
7. _PR_: template sections, the exact footer, "don't edit DECISIONS/PLAN/HANDOFF/README", list decisions + shared files touched.
8. _Final report format_.

- **Effort** S · **Risk** none.

#### B28 — HANDOFF inaccuracies checked against the code

- §1 open items: the a11y list is partly fixed (roster cards and Active/Injured, B25) and partly incomplete (B26: 30 + 43 failures). "`useShortNames` is unused" is correct.
- §2 item 4: "DECISIONS (#1–183)" → **#1–222** (§1 says #222 correctly). Item 5 "WORKER_BRIEF written for v3; for v4/v5 the data model notes are outdated" understates it (B27).
- §3 Domain bullet: "`exportSchema` (zod + upgrades of v1–v3 files)" → v1–v8 files. Most v5+ modules are only listed in later bullets.
- §3 Store bullet: "one `useAppStore` (profiles, teams, players, matches, presets, currentProfileId, language)" is missing `seasons`, `opponents`, `chipLabel`, `themeMode`, `dyslexiaFont`, `hydrated` (`src/store/types.ts:22-46`).
- §3 Platform bullet: "(file transfer, print, drag activation, switch props, document language)" is missing `pickPhoto`, `unlock`, `inert`, `themeColor`, `cancelPress`.
- §3 Features bullet: missing `team`, `matchForm`, `seasons` (they're mentioned in the v7 bullet) and `photos`/`playerDetail`/`descriptions`/`performance` (in the v6 tail; fine).
- §6 "Jest mocks … don't add per-file hacks" vs 3 per-file Reanimated re-mocks (B23).
- CLAUDE.md "Folder structure": `src/i18n/en.ts — All user-facing strings` is outdated (B14). `__fixtures__` and the test helper locations are undocumented (B15).
- **Effort** S · **Risk** none.

#### B29 — Make the audit scripts permanent (optional)

- `b-work/unused.js` (unused/test-only exports) and `b-work/check.js` (label-in-name) were cheap to write and found real issues. Add the first as `scripts/unused-exports.js` (informational, not gating) and the second as a Jest test (B26).
- **Effort** S · **Risk** none.

---

### Ranked recommendation

#### DO (v8.3, zero visible change)

1. **B12** dead code + unused i18n keys: deletes ~80 lines, no risk, and shrinks `roster.ts`.
2. **B1** split `exportSchema.ts` behind a barrel: the biggest maintainability win for every future data-model bump.
3. **B6** shared `legacyData.ts` for store migrations + export upgrades (do it with or right after B1).
4. **B16** remove the 24 provably unnecessary casts (types only).
5. **B2 / B4** split `seasons.ts` and `lineupSheet.ts` (barrels, pure moves); fix the `durationParts` / `playerName` homes.
6. **B7** one `Dialog` shell for the 6 identical modals (same style object, so the same pixels).
7. **B3** split `liveSet.ts` (scoring / sub rules / court view).
8. **B9 / B17 / B18** small consolidations (row constants, `pad`, `POINT_KINDS`, tuple consts → no zod casts, named regex groups, `useStartupRedirect` deps, test `require`).
9. **B21 + B22 + B23** `src/test-utils` (seedApp with real seasons, renderApp, includeHidden), Reanimated spies in `jest.setup.ts`. Migrate incrementally.
10. **B8 / B10 / B15** move the shared UI kit out of `features/roster`, `MatchForm` into `matchForm`, `SetChipFilter`, thin the two screens (`(tabs)/_layout`, `match/[matchId]/index`).
11. **B27 / B28 / B13 / B14** rewrite WORKER_BRIEF, fix HANDOFF §2/§3 and the stale code comments, update CLAUDE.md folder notes.

#### DO, but as a separate PR that needs the owner's OK (text change, no pixels)

- **B25 / B26** label-in-name fixes (EN + DE) plus a guard test. They change screen-reader text, so they don't meet the "zero change" bar on their own.

#### SKIP (for v8.3)

- **B5** split `tabMotion.ts` / refactor `useTabPager`: worklet code that hasn't been verified on a phone; the device risk outweighs the readability gain.
- `noUncheckedIndexedAccess` (B16 note): the right long-term move, but too many edits for a no-change release.
- `appStore.ts` slice split (B11): touches persistence wiring.
- Merging `Segmented` / `SetupFormationRow` / `SetTabs` / `SetPicker` (B8): they look similar but differ in layout, so merging risks pixel changes.
- Renaming i18n namespaces (`presets.nav`, `roster.matches` …) (B14): churn across tests for little gain. Document instead.
- Changing `Stats.players` record types (B20): touches stats UI; the casts are already removed by B16.
- Re-enabling the remaining `exhaustive-deps` suppressions in `CourtMotion`/`SlideTransition` (B18): animation timing risk.
