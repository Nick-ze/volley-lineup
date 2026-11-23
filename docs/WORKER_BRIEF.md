# Worker brief (shared by all worker agents)

Repository `Nick-ze/volley-lineup`, base branch `main`. Current state: app 8.3 (store version **10**, export
`schemaVersion` **9**). This brief is the checklist; the architecture lives in `docs/HANDOFF.md` §3 and the
gotchas in §6 — read those instead of relying on lists here.

## 1. Read first (binding)

1. `CLAUDE.md` → `docs/HANDOFF.md` §3 (architecture) and §6 (gotchas) → the current version's section of
   `docs/PLAN.md` → the `docs/DECISIONS.md` entries that touch your files. Volleyball questions:
   `docs/VOLLEYBALL_RULES.md`.
2. Your task names your branch, the files you own and the files you must not touch.

## 2. Setup

- You work in your own git worktree: `git fetch origin main && git checkout -B <your-branch> origin/main`, then
  `npm ci` (Node 22). Use a unique local branch name; never check out another worker's branch.
- New Expo packages only if unavoidable: `EXPO_OFFLINE=1 npx expo install <pkg>` (the sandbox can't reach
  api.expo.dev), and say why in the PR.
- Scratch files (builds, screenshots, measurements) go in your own subfolder of the session scratchpad, never in
  the repo.

## 3. Stack and where things live

Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 (strict + `noUnusedLocals` etc.), Expo Router, Zustand 5
(+ AsyncStorage persist), zod 4, RNGH 3 + Reanimated 4.7, Jest 30 (jest-expo) + RNTL 14. Routes, domain modules,
store fields, features and components: HANDOFF §3.

- `src/domain/` — pure TypeScript, 100 % coverage (statements, branches, functions, lines). `types.ts` is the only
  place for data-model types. Screens and components never contain rotation, validation or stats logic.
- `src/store/` — `useAppStore` (version 10, migrations in `migrations.ts`) and `photoStore` (photos under their own
  storage keys). Use the hooks in `src/store/hooks.ts`; never return a fresh array / object from a selector
  without `useShallow` (Zustand 5 loops).
- `src/lib/` — platform code only here: mostly a base `x.ts` (native / default) with an `x.web.ts` override,
  some `x.native.ts` (file transfer, print, drag activation, switch props, document language, photo picking,
  unlock, `inert`, theme colour, cancel press). No `Platform.OS` checks in screens.
- Persisted shape changes (store version + migration, export `schemaVersion` + upgrade, zod `Same<>` guard,
  consistency checks, tests) are done by the orchestrator in the foundation PR, not by workers.

## 4. Binding rules

- **Theme**: styles via `makeStyles((theme) => ({ … }))` → `const styles = useStyles()`; colours from the theme
  tokens (`primaryText` / `highlightText` / `secondaryText` for coloured text on backgrounds, `on*` for text on
  fills, `onCourt` on the court), `useTheme()` for values in code, `inlineFontSize()` for inline sizes. Name the
  factory parameter `theme` (`t` is the translation object). No colour literals outside `src/theme` (a test
  enforces it); no spacing literals — use `spacing`, `radius`, `touchTarget`.
- **i18n**: strings in `src/i18n/en/<area>.ts` and `src/i18n/de/<area>.ts` (shared ones in `en.ts` / `de.ts`);
  read them with `const t = useT()`. German is typed from English, so a missing key fails typecheck. Informal
  "du"; volleyball terms per DECISIONS #70. Never import `@/i18n/en` or `@/i18n/de` from `app/` or `src/`
  (ESLint); tests may.
- **Accessibility**: every interactive element has an `accessibilityLabel` that **starts with its visible text**
  (WCAG 2.5.3; pattern "Visible text: extra context", e.g. "Point us: we won the rally", "Löschen: Team X"). The
  guard test `__tests__/labelInName.test.tsx` checks it in EN and DE — add new dialogs / hidden controls to its
  `PAIRS`. Touch targets ≥ 44 × 44. react-native-web ignores `accessibilityState` → also set `aria-checked` /
  `aria-selected` / `aria-disabled`. Drag and drop always has the tap alternative.
- **Dialogs**: RN `Modal` like the existing dialogs; never `Alert.alert` (does nothing on web).
- **Tabs and swipe**: every `SwipeTabs` needs `renderTab` (the pager keeps the tabs ±1 mounted, keyed by tab;
  hidden pages are hidden from assistive tech). Wrap anything that scrolls or drags sideways inside a swipeable
  page in `NoTabSwipe`. Put `touchAction` in the gesture config, not on `GestureDetector`.
- **Live screen height**: court + Substitution must stay visible at 390 × 844 (DECISIONS #126, #164, #212).
- Components small (aim < 150 lines); no `any`, no `@ts-ignore` / unexplained suppressions.
- Don't edit `docs/DECISIONS.md`, `docs/PLAN.md`, `docs/HANDOFF.md`, `README.md` — list decisions in the PR.

## 5. Testing recipes

- RNTL 14 is async: `await render(…)`, `await fireEvent.press(…)`.
- Shared helpers in `src/test-utils` (excluded from coverage):
  - `seedApp({ players, matches, presets, language })` — profile `prof1`, team `team1`, season `s1` and real
    opponents (via `seasonRefs`), so the data is consistent. `makePlayer`, `makeSet` build the parts.
  - `seedGolden(language)` — the export golden data (`src/domain/__golden__/input.json`, profile `pr1`).
  - `renderApp(url)` — the whole app via `renderRouter` with a hydrated store; `resetStores()` resets the app
    and photo stores.
  - `includeHidden` — query option to also find elements on hidden pager pages / decorative elements;
    `isShown(el)` tells whether an element is on the shown page. Default queries see the shown page only.
  - Fixtures: `presetsTeam.ts` (12-player roster, `seedTeam`, `fullLineup`), `rotationSeed.ts`,
    `seasonRefs.ts`.
- Seed `usePhotoStore` (`setPhoto`) before pointing a profile / player at a photo (the prune clears dangling ids).
- Query by `t.*` strings (`import { t } from '@/i18n/en'`) rather than hard-coded label text.
- Reanimated / worklets / RNGH mocks live in `jest.setup.ts`; don't add per-file mocks unless you must spy.
- Never weaken or delete a test; if an expectation legitimately changes, say why in the PR.

## 6. Proving "no change" (refactors)

- `src/domain/__golden__/exportGolden.test.ts` must pass untouched (never run `UPDATE_GOLDEN=1` unless the
  orchestrator changes the export format).
- Screenshots of every main screen (375 / 1280 px, EN + DE, dark + light, font on / off) against a baseline:
  `npx expo export -p web --output-dir <dist>`, `node scripts/screenshots.js <dist> <shots>`,
  `node scripts/screenshots.js --compare <baseline> <shots> <diff>` → expect "0 differ".

## 7. Definition of done

1. `npm run check` (lint, format check, typecheck, tests) and `npm test -- --coverage` (domain 100 %) pass, and
   `npx expo export -p web` succeeds.
2. Browser check of what you changed: serve the export (`npx serve -s dist -l <free port>`) and drive it with
   Playwright (`require('playwright')`). Both come from the sandbox, not from `package.json`; Chromium is
   preinstalled — never `playwright install`. Check at 375 and
   1280 px, English and German, dark and light, the dyslexia font on at 375 px in German. Gestures with mouse and
   touch emulation (`hasTouch` + CDP touch events).
3. Small commits (`feat(live): …`); messages end with the attribution lines you were given.
4. `git push -u origin <branch>` (retry up to 4× on network errors); open a PR into `main` with the GitHub MCP tool
   `mcp__github__create_pull_request`. Body: what changed, how it was tested, UI notes, acceptance items covered,
   shared files touched, dependencies added, decisions. It ends with exactly the footer you were given — these
   two lines with a blank line between them, and nothing after (never a `_Generated by …_` line):

   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   https://claude.ai/code/session_<id>
   ```

   Check the body after creating the PR (the tool has added its own footer before) and fix it with
   `mcp__github__update_pull_request`.

5. Do **not** merge. Final report: branch, PR URL, done / not done, decisions, open questions.
