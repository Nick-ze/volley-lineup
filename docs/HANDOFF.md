# Handoff — start here in a new chat

This file lets a fresh Claude session continue Volley Lineup where the last one stopped.
**Run `/start` in a new chat** (it reads this file and the right docs).
**Run `/wrap-up` before you close a chat** (it updates this file).

Last updated: 2026-11-21, after releasing **v3.0.0**.

---

## 1. Where we are

| Version | What it added                                                                                                                                                          | Release  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| v1.0.0  | Profiles, teams, roster, matches, lineup builder (drag & drop + tap), rotation viewer, starters overview, export/import, persistence                                   | `v1.0.0` |
| v2.0.0  | Libero swaps, 5-1/6-2 templates, live match mode, substitutions, lineup lock, print/PDF, German                                                                        | `v2.0.0` |
| v2.1.0  | Phone lineup layout (bench under the court), app tab bar (Teams · Profile · Settings), Profile tab with log out                                                        | `v2.1.0` |
| v2.2.0  | Team nav bar (Roster · Matches · Presets · Starters), saved lineup presets, team starters (pre-fill new matches), data model v3                                        | `v2.2.0` |
| v3.0.0  | Whole-match live mode (set score, next-set setup, match summary, undo across sets), Stats tab + match stats, optional point tagging, print with results, data model v4 | `v3.0.0` |

- `main` is green (CI), **587 tests**, `src/domain` at 100% coverage.
- Current versions: app **3.0.0** (`app.json` + `package.json`, must match), store **4**, export `schemaVersion` **4**.
- Last decision number in `docs/DECISIONS.md`: **#111**. Continue at #112.
- Releases: https://github.com/Nick-ze/volley-lineup/releases (APK per version).

### Open items / known gaps

- Never verified on a real phone: v2.x / v3.0 APKs (incl. the store v3 → v4 upgrade in Android AsyncStorage, the live screen with tag row on a device, safe areas), native touch drag & drop, the phone PDF (`expo-print`). v3 was checked in a browser only (Playwright, 390×844 / 375 / 1280, EN + DE).
- GitHub Pages (web version) is not enabled — the repo is private; the owner must enable Pages (Settings → Pages → Source: GitHub Actions) or make the repo public. The deploy workflow skips with a warning until then.
- The Android emulator smoke test (`android-smoke.yml`) is manual-only and flaky on hosted runners.
- Small known nits (not bugs): at 320 px (below the 375 px target) the German "Aufstellungen" / "Rückgängig" labels clip a few px inside their buttons; react-native-web's `Modal` plus the print choice card give two nested `role="dialog"` elements.
- Remote branch `docs/v3` is merged content (via #29) but couldn't be deleted (git proxy refuses branch deletes) — safe to delete from GitHub.

### Ideas for next versions (from the owner's requests and the plan)

- Stats ideas not built: per-rotation totals row, charts/trends over the season, CSV export of stats, opponent-side stats.
- Tagging: more kinds (e.g. dig / serve error), tags for points before v3 can't be added afterwards (only the last rally is taggable).
- Cloud sync / real accounts (explicitly out of scope so far — needs a backend; see DECISIONS #55).
- Whatever the owner asks for next — ask them if the request is ambiguous (e.g. "presets" was interpreted in DECISIONS #80–85).

---

## 2. Read these (in this order)

1. `CLAUDE.md` — binding rules (code, tests, git, agents).
2. `docs/HANDOFF.md` — this file.
3. `docs/PLAN.md` — features and data model (§1–10 v1, §11–13 v2, §14 v2.2, §15–17 v3).
4. `docs/DECISIONS.md` — every choice made so far (#1–111). Skim headings; read the ones touching your task.
5. `docs/WORKER_BRIEF.md` — the brief given to worker agents (conventions, testing notes). Current as of v3 (its "being built" note about stats is now done: `stats.ts` and the Stats tab are on main).
6. `README.md` — user-facing features, install, release steps.

---

## 3. Architecture in one screen

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 strict, Expo Router, Zustand v5 + AsyncStorage, zod, RNGH v3 + Reanimated 4, Jest (jest-expo) + RNTL v14.
- **Routes** (`app/`): `/` profile picker · `(tabs)` group with `/teams`, `/profile`, `/settings` (bottom app tab bar) · `/team/[teamId]?tab=roster|matches|presets|starters|stats` (team nav bar, a component in `src/features/team/`) · `/team/[teamId]/player` (modal) · `/team/[teamId]/match-new` (modal) · `/team/[teamId]/preset/[presetId]` · `/team/[teamId]/starters` · `/match/[matchId]?set=N` (lineup builder) · `/match/[matchId]/rotation|starters|live|stats` (live without `?set` opens the current set / summary) · `+not-found`. Header titles go through `HeaderTitle` (one line, truncates) set in `app/_layout.tsx`.
- **Domain** (`src/domain/`, pure, 100% tested): `types.ts` (single source of types), `rotation`, `lineupValidation`, `lineupEditing`, `lineupLock`, `liberoSwap`, `templates`, `liveSet` (replay of the event log; `replaySteps` gives the state before each event), `matchState` (set/match results, current set, duration — derived, never stored), `matchFlow` (next-set setup, serve default, undo across sets), `stats` (rotation / player / season stats incl. tag totals), `pointTags` (tag kinds and validity, `tagLastPoint`), `lastRally` (who was on court during the last rally, plausible tag kinds), `presets`, `playerUsage`, `roster`, `exportSchema` (zod + upgrades of v1–v3 files), `lineupSheet` (print HTML, optional results section).
- **Data model v4**: point events `{ type: 'point', winner, kind?, playerId?, at? }` (tags + ISO timestamp); subs unchanged. Nothing about results is stored.
- **Store** (`src/store/`): one `useAppStore` (profiles, teams, players, matches, presets, currentProfileId, language). Version 4 with migrations v1→v2→v3→v4 in `migrations.ts` (v3→v4 changes nothing). List selectors are hooks with `useShallow` (Zustand v5 loops otherwise).
- **Features** (`src/features/`): roster, team, lineup (builder; `useLineupDraft` is the generic editor), rotation, live (whole match: `LiveMatch` → `LiveSetView` / `NextSetSetup` / `SetWonPanel` / `MatchSummary`, tag row `PointTagRow` + `usePointTagging`, result label `matchResult.ts`), stats (tables with fixed first column), presets, print (choice dialog with/without results), profile, settings.
- **i18n**: `src/i18n/en/*.ts` + `src/i18n/de/*.ts`, `useT()` hook; the German type is derived from English so missing keys fail typecheck; ESLint forbids importing `@/i18n/en` directly.
- **Platform code** only in `src/lib/*.web.ts` / `*.native.ts` (file transfer, print, drag activation, switch props, document language).
- **Theme** tokens in `src/theme/` (dark app theme; `print.ts` light print theme).

---

## 4. How work is done here (the orchestrator pattern)

The owner gives short requests and is usually not watching. The pattern that worked:

1. **Read** the docs above. If a request is ambiguous, pick a sensible interpretation, say it in one line, and go (the owner prefers action over questions).
2. **Shared foundation yourself** first (data model/types, migrations, export schema, version bumps, docs), merged before workers start, so parallel work doesn't conflict.
3. **Workers** (Agent tool, `isolation: "worktree"`, background) for independent features — one branch + PR each, with a precise brief: task, owned files, forbidden files, design decisions already made, tests, "don't edit DECISIONS.md (list decisions in the PR body)", "don't merge".
4. **Independent reviewer** agent per PR (didn't write the code): runs lint/typecheck/tests/web export, verifies rules by hand, Playwright at 375 and 1280 px, EN + DE. Forward findings to the worker via SendMessage.
5. **Merge** only with green CI (check `pull_request_read get_check_runs`). Squash when intermediate commits don't build.
6. **QA agent** over the acceptance checklist after a version's features are in.
7. **Docs**: add DECISIONS entries centrally (one PR), tick PLAN checklists, update README.
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
- **Pre-wire shared files in the foundation PR** (i18n files per worker in `en.ts`/`de.ts`, new routes in `app/_layout.tsx` + `parentRoute.ts`, nav strings): it removed almost all merge conflicts between parallel workers in v3.
- **Before merging a PR whose base is behind `main`**: merge `origin/main` into its branch (in a scratch worktree), run the checks, push the merge commit, and merge only after CI is green on that SHA.
- **Header titles on web**: the header's title container doesn't shrink, so long titles overflow the page; `HeaderTitle` caps its own width — keep using it.
- **Branch names**: old feature branches still exist on origin (e.g. `feat/live-match` from v2) — pick new names; the git proxy can't delete remote branches.
- **Label in name** (WCAG 2.5.3): an `accessibilityLabel` must start with the button's visible text — reviewers check this.

---

## 7. Checklist for starting a new version

- [ ] `/start` → read docs, `git fetch origin main`, `npm ci`, run `npm run lint && npm run typecheck && npm test`.
- [ ] Write the version's plan into `docs/PLAN.md` (new section with features, data model changes, acceptance checklist).
- [ ] Foundation PR (types/store/export migrations + version bump if the data shape changes).
- [ ] Workers → reviews → merges → QA → fixes.
- [ ] DECISIONS + README + PLAN ticks → release (§5).
- [ ] `/wrap-up` before the chat ends.
