# V11 — "Less app, more gym" (design release)

The build brief for Volley Lineup 11.0.0. It changes how the app looks and nothing about what it does. The design is decided; the owner approved it on 2026-11-27 (DECISIONS #336–#343). Where this brief is silent, choose the simplest option that fits the five rules below and record it in `docs/DECISIONS.md`.

The mock-ups (four screens, before and after, dark and light) are at https://claude.ai/artifact/VHo28JVUot3hFoocC1HwKo. Read the page once with the Artifact tool (`action: "read"`): the "after" drawings are HTML and CSS, and their values are the ones below. The drawings are approximate where this brief says so; the brief wins.

## As built (2026-11-27)

Built in seven pull requests (#112–#118), each merged on green CI. Where the result differs from this brief, the brief below is left as written and the difference is recorded in `docs/DECISIONS.md`:

- Print / PDF is an icon in the match header and there are four link tiles, not five (#345).
- A third header variant, `bare`, for performance and match stats; header parts are wrapped in `appHeaderOnly()` (#346).
- The live score is 88 px so the scoreboard keeps its height (#348).
- Forms keep their panel (#349).
- All buttons are 44 px high; there is no smaller pill.
- The review agent after PR 3 and the QA agent in PR 7 were left out; the checks that ran are listed in #354.

## The five rules

1. **The title is part of the page.** No grey header bar. A screen opens with its title on the page background. Back is a round button.
2. **Every colour has one job.** Solid orange: the court and the one main action of a screen. Soft orange: what is selected. Yellow: what is current (this set, the server) and notices. Blue: the opponent, the front row, links.
3. **Numbers are the picture.** Titles, scores and jersey numbers on roster cards use Barlow Condensed. Everything else stays in the platform font.
4. **Tone, not outlines.** A panel is `surface` on `background` with no border. Borders stay only on focused text fields, the `danger` button and the court.
5. **Shapes mean something.** Buttons are pills. Teams are rounded squares. Players are circles.

## Hard limits

- No feature change. No stored-data change: store version stays 13, export `schemaVersion` stays 10, the export golden stays byte-equal.
- Nothing under `src/lib/sync`, `src/domain/sync*`, `supabase/`. In every PR `git diff --stat origin/main -- src/lib/sync supabase src/domain src/store/migrations.ts` must be empty. `src/store`: at most a read-only selector hook if one is missing; say so in the PR.
- No user-facing text is added or reworded. Use the strings that exist. Icon buttons reuse the accessibility labels of the text buttons they replace. The only new i18n key allowed is a joiner for the builder's header subtitle (PR 5), and only if no helper exists. If you think you need another string, don't add it: list it under "Open questions" in the PR.
- Keep: light / dark / system, the dyslexia font, EN + DE, touch targets ≥ 44 × 44, AA contrast, phone and web, the wide layout (≥ 768 px).
- The court (`Court`, `CourtSlot`, `courtStyle`), role tags, position badges and the print sheet stay as they are. The only change to player chips is the ring and shadow in PR 5.
- No release and no tag. The last step is a test build for the owner. Then stop.
- Project rules as in `CLAUDE.md`: no colour literals outside `src/theme` (a test enforces it), spacing and radius from `src/theme`, styles through `makeStyles`, platform differences only in `src/lib/*.web.ts` / `*.native.ts`, components under about 150 lines, every interactive element has an `accessibilityLabel` that starts with its visible text.

## How to work

- Seven pull requests, in this order, one at a time, from the session branch (HANDOFF §6, "Several PRs in a row from one session branch"). Each is merged only on green CI (owner, 2026-11-27).
- Before each PR: `npm run check` and `npx expo export -p web --clear`.
- Screenshots for each PR: build `origin/main` and your branch, run `node scripts/screenshots.js <dist> <outDir> --only <name>` for the screens the PR touches (375 px, EN + DE, dark + light, font off + on), and **look at them** (make contact sheets with ImageMagick `montage` and read them). Describe in the PR what changed and anything that looks wrong. For PR 2, PR 3 and PR 7 run all screens.
- Tests: each new shared component gets a component test. A test that asserts the old look or an old visible text may be changed to assert the new one; name each such test in the PR. Never loosen a test of behaviour. Keep every `testID`.
- One independent review agent after PR 3 (it did not write the code; it runs the checks, opens the web build at 375 and 1280 px in EN and DE, both themes, font on, and reports concrete faults). One QA agent in PR 7 over the acceptance list.
- Phone-only behaviour can't be seen in Playwright. Say in each PR what you could not check.

## PR 1 — plan and theme values

**Docs.** This brief is `docs/V11_DESIGN.md`. Add PLAN §46 "v11.0 — Look" (the five rules, the PR list) and §47 (the acceptance list at the end of this brief). Add the DECISIONS entries for the six owner decisions: Barlow Condensed; pill tab bar; icon buttons in rows; builder with Live in the header and five link tiles; dark roster cards with an orange number; everything in 11.0.0, released only after the owner tried a test build. Plus two later wishes: more contrast for players on the court (ring and shadow), and no icon in notices.

**Screenshot script.** Add `['account', '/account']` and `['sign-in', '/account/sign-in']` to `SCREENS` in `scripts/screenshots.js`.

**`src/theme/colors.ts`** — add these tokens to both palettes:

| Token            | Dark              | Light             | Use                                 |
| ---------------- | ----------------- | ----------------- | ----------------------------------- |
| `primarySoft`    | `#2B1707`         | `#FFE9D9`         | selected segment, active tab marker |
| `primaryPressed` | `#E05E00`         | `#E05E00`         | pressed primary button              |
| `highlightSoft`  | `#2E2508`         | `#FFF4D1`         | notices (banners)                   |
| `secondarySoft`  | `#0A1E36`         | `#E0ECFA`         | soft blue chips                     |
| `positive`       | `#2ECC71`         | `#2ECC71`         | the "active" dot (never text)       |
| `chipRing`       | `#FFFFFF`         | `#0D0D0D`         | ring of a player chip on a court    |
| `chipShadow`     | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.4)` | shadow of a player chip on a court  |

Measured: `primaryText` on `primarySoft` 5.99 (dark) / 5.16 (light); `text` on `primarySoft` 17.1 / 16.1; `highlightText` on `highlightSoft` 9.72 / 6.05; `secondaryText` on `secondarySoft` 5.06 / 6.47; `onPrimary` on `primaryPressed` 5.34. Add these pairs to the AA test in `src/theme/theme.test.ts`.

**`src/theme/spacing.ts`** — `radius = { sm: 8, md: 12, lg: 20, xl: 28, round: 999 }` (was 6 / 10 / 16). `sm`: badges, name pills, segments. `md`: fields, tracks, tiles, banners. `lg`: panels, rows, cards, point buttons. `xl`: dialogs, tour sheets, the scoreboard. Spacing values don't change; screen margins stay 16.

**Typeface.** No new dependency. In the scratchpad run `npm pack @expo-google-fonts/barlow-condensed@0.4.1`, unpack it, and copy `700Bold/BarlowCondensed_700Bold.ttf` → `assets/fonts/BarlowCondensed-Bold.ttf`, `800ExtraBold/BarlowCondensed_800ExtraBold.ttf` → `assets/fonts/BarlowCondensed-ExtraBold.ttf`, `LICENSE_FONT` → `assets/fonts/BarlowCondensed-OFL.txt` (SIL OFL 1.1). Checked: both files are about 104 kB, contain ä ö ü ß é è à ç and have the `tnum` feature. Their digits are **not** equal-width by default, so every number in this font needs `fontVariant: ['tabular-nums']`.

- `src/theme/fonts.ts`: export `DISPLAY_FONT_BOLD = 'BarlowCondensed-Bold'` and `DISPLAY_FONT_HEAVY = 'BarlowCondensed-ExtraBold'`. `ThemeFonts` gains `display`, `displayHeavy` (system fonts: the two Barlow names; dyslexia fonts: `OpenDyslexic-Bold` for both) and `displayScale` (1; dyslexia 0.75).
- `src/lib/fonts.ts`: two `useFonts` calls, one for the two Barlow files and one for OpenDyslexic. The app waits for Barlow always and for OpenDyslexic only when the dyslexia font is on, each at most `FONT_TIMEOUT_MS`; on failure the platform font shows. Wire it in `app/_layout.tsx`. Update `fonts.test.ts`.
- `src/theme/typography.ts`: keep every existing entry and `fontSize` value. Add (no `fontWeight` on styles with a custom family):

| Entry       | Family   | Size / line height | Extra                                              |
| ----------- | -------- | ------------------ | -------------------------------------------------- |
| `displayXL` | bold     | 48 / 53            | titles of the three tab screens, profile picker    |
| `displayL`  | bold     | 34 / 38            | titles of pushed browse screens, point buttons     |
| `displayM`  | bold     | 26 / 29            | compact header title, dialog titles, stat numbers  |
| `score`     | heavy    | 104 / 100          | `fontVariant: ['tabular-nums']`                    |
| `eyebrow`   | platform | 12, weight 700     | `letterSpacing: 0.9`, `textTransform: 'uppercase'` |

- `src/theme/theme.ts`, `withFontFamily` with the dyslexia font on: a style whose `fontFamily` is one of the two display families gets `fonts.bold`, size `round(size × fonts.scale × fonts.displayScale)` and its line height scaled by the same factor; a style with `textTransform: 'uppercase'` loses the uppercase and its positive `letterSpacing` (capitals are harder to read with that font). `inlineFontSize` gets the same display rule through an optional argument. Unit tests for all of it.

**Check.** The only visible change in this PR is the rounder corners. Screenshots of all screens, look at a sample of 20.

## PR 2 — the header

New `src/components/AppHeader.tsx`, used as `header: (props) => <AppHeader {...props} />` in the root Stack's `screenOptions` (`app/_layout.tsx`). The native stack's `header` option exists in expo-router 58 (`build/react-navigation/native-stack/types.d.ts`). It keeps every per-screen option working: it renders `options.headerLeft`, the title (`options.headerTitle` when it is a function, else `HeaderTitle` with `options.title`) and `options.headerRight`.

- Background `colors.background`, no border, no shadow. Top padding = the top safe-area inset (for a modal on iOS use a helper in `src/lib` with an `.ios.ts` variant that returns 0; iOS can't be tested here, keep it simple).
- **Compact** (default): one row, `minHeight` 56, horizontal padding `spacing.md`, gap `spacing.sm`: back, title (flex 1, `typography.displayM`, one line, "…"), right.
- **Large**: row 1 (`minHeight` 52) back, spacer, right; row 2 (horizontal padding `spacing.lg`, bottom padding `spacing.sm`) the title in `typography.displayL`, one line, `adjustsFontSizeToFit` with `minimumFontScale` 0.75, with the `leading` picture (44 px) when given.
- Which routes are large is one set of route names in `src/lib/headerVariant.ts`: `team/[teamId]/index`, `team/[teamId]/season/[seasonId]`, `team/[teamId]/players/[playerId]`, `account/index`, `account/sign-in`, `account/teams`, `team/[teamId]/members`, `join`. Everything else is compact (all `match/*` screens, the preset and starters editors, the form modals).
- `HeaderTitle` reads the variant from a context that `AppHeader` provides and gets an optional `subtitle` (one line, `typography.caption`, `textMuted`; used in PR 5). Its width cap stays for the compact variant.
- `HeaderBack`: a 44 × 44 pressable with a 40 px circle (`surface`) and Ionicons `chevron-back` 22 in `text`. Label `t.common.back`, `testID` and behaviour unchanged. Remove the now unused `backWithChevron` key in EN and DE.
- Tab screens: in `app/(tabs)/_layout.tsx` set `headerShown: false`. `Screen` gets `title`, `eyebrow` and `titleRight` props; with a `title` it adds the top safe-area edge and renders a new `PageTitle` (eyebrow in `typography.eyebrow` `textMuted`; title in `typography.displayXL`, `accessibilityRole="header"`, one line, `adjustsFontSizeToFit`, `minimumFontScale` 0.7).
  - Teams: eyebrow = the profile's name, title = `t.nav.teams`, right = `SyncBadge` and the profile's avatar (40 px, existing `Avatar`). This replaces "Coach Müller's teams".
  - Profile: title = `t.profile.tabs.profile`. Settings: title = `t.nav.settings`.
- Profile picker (`index`): `headerShown: false`; `Screen` title = `t.nav.profiles`; above it `assets/images/icon.png` at 56 px with `radius.md`, decorative.
- Team screen: `TEAM_HEADER_AVATAR` = 44. `TeamAvatar` becomes a rounded square everywhere: `borderRadius: Math.round(size * 0.27)`.

**Check.** All screens. Each shows its title exactly once. Back works with history and after a reload (fallback route). The team's Share / Members button and the live Performance / Live button are there. German with the dyslexia font at 375 px: no title is cut in the middle of a word without "…".

## PR 3 — shared parts

- **`Button`**: `borderRadius: radius.round`, `minHeight` 44, horizontal padding `spacing.xl` (`compact`: `spacing.lg`), optional `icon` (Ionicons name, 18 px, before the label). Variants: `primary` (bg `primary`, text `onPrimary`, no border, pressed bg `primaryPressed`); `secondary` (bg `surfaceRaised`, text `text`, no border); `ghost` unchanged; `danger` (transparent, `error` text, 1 px `error` border); new `dangerQuiet` (transparent, `error` text, no border). All buttons stay 44 px high; the 36 px pills in the drawings are approximate.
- **New `IconButton`**: 44 × 44, Ionicons 22 in `textMuted`, required `accessibilityLabel`, `testID`.
- **Panels and rows** (`formStyles.ts`): `card` and `row` get bg `surface`, `radius.lg`, `borderWidth: 0`. `ListRow`: `minHeight` 64, title one line; trailing actions stay in the row (lower `listRowMainMinWidth` to 140; wrapping below stays as the fallback for the dyslexia font).
- **New `SegmentedTrack`** (replaces the look of `lineup/Segmented`, `lineup/SetTabs`, `SetChipFilter`, the rotation stepper's 1–6, the language and theme switches): track bg `surface` (prop `onPanel` → `surfaceRaised`), `radius.md`, padding `spacing.xxs`, gap `spacing.xxs`; each segment `minHeight` 44, `radius.sm`, `typography.label`. Selected, kind `choice`: bg `primarySoft`, text `primaryText`. Selected, kind `set`: bg `highlight`, text `onHighlight`. Unselected: text `text`; "not set up yet" (today's dashed sets) and disabled: `textMuted`. A locked control's selected segment: bg `surfaceRaised`, text `textMuted`. Keep roles, `aria-selected` / `aria-checked` and test IDs of the controls it replaces.
- **`ChoiceChip`** (free-standing chips): pill, `minHeight` 44, bg `surface`, no border; selected bg `primarySoft`, text `primaryText`.
- **`TextField`**: bg `surfaceRaised`, `radius.md`, `minHeight` 48, border 1.5 px transparent, on focus `primaryText`, on error `error`; label above in `typography.label` `textMuted`.
- **`Dialog`** and the tour sheets / popups: bg `surface`, `radius.xl`, no border, padding `spacing.xl`, title `typography.displayM`, actions right-aligned.
- **New `Banner`**: bg `highlightSoft`, text `highlightText`, `radius.md`, padding `spacing.sm` / `spacing.md`, `typography.label`. **No icon and no emoji** (owner's wish). Use it wherever a yellow notice text stands today.
- **New `EmptyState`**: a small court drawn with Views (72 × 56, 2 px `border` outline, `radius.sm`, one line a third from the top), then the existing "empty" sentence in `typography.body` `textMuted`, centred, max width 280. No button of its own: the screen's existing add button stays the one action.
- **New `PillTabBar`**, used by `TeamNavBar` and, through the `tabBar` prop of `Tabs`, by the app tabs. Outer: bg `background`, horizontal padding `spacing.md`, top `spacing.sm`, bottom `max(bottom inset, spacing.md)`. Bar: bg `surface`, `radius.round`, padding `spacing.xs`. Item: flex 1, `minHeight` 48, `radius.round`, icon 22 over a label (`typography.label` at `fontSize.xs`; keep `TeamNavBar`'s dyslexia letter-spacing rule). Selected: bg `primarySoft`, tint `primaryText`; others `textMuted`. Roles `tablist` / `tab`, `aria-selected`, the same labels, hints and test IDs as today. The app tab bar must emit `tabPress` and navigate exactly as React Navigation's default bar does, so the pager in `app/(tabs)/_layout.tsx` keeps working (tap slides, drag follows the finger). If a custom `tabBar` can't be done without changing pager behaviour, keep the default bar, style it as close as its options allow, and say so in the PR.
- `settings/Section.tsx`: the heading moves above the panel as `typography.eyebrow`; the panel holds the description and controls.

**Check.** All screens, both themes. No panel has an outline. No screen has two solid-orange buttons except Live (the court and the "Point us" button are orange by design). Then the review agent.

## PR 4 — Teams, profile picker, team tabs

- **Teams** (`TeamList`, `TeamRow`, `ProfileHeader`): "New team" primary and "Join a team" secondary in one row under the title. A team is a `ListRow`: leading `TeamAvatar` 52, name, subtitle = the existing player-count string (`t.roster.team.playerCount(n)`), then `IconButton`s Edit (`pencil`) and Delete (`trash-outline`), then the chevron. Delete flows unchanged.
- **Roster** (`RosterTab`, `PlayerCard`): header row = the player count as eyebrow, "Player list (PDF)" secondary, "Add player" primary. Card: `surface`, `radius.lg`, no border, clipped. Picture square as now. Without a photo: bg `surfaceRaised` and the jersey number in `DISPLAY_FONT_HEAVY`, colour `primaryText`, size `round(card width × 0.72)` through `inlineFontSize`. Name left-aligned in `typography.body` at weight 700. Then "#n" and the position badges. Active / Injured: a full-width pressable row 44 px high that shows a pill (28 px high, bg `surfaceRaised`, `radius.round`) with an 8 px dot (`positive` / `error`) and the existing text; role, state and label as today. The captain badge stays. The duplicate-numbers warning becomes a `Banner`.
- **Matches tab** (`SeasonsTab`, `SeasonCard`, `KindBadge`): flat panel, no coloured edge. The kind is an eyebrow above the name (`primaryText` for a season, `secondaryText` for a tournament) instead of a filled badge. If the record exists as its own value, show it right-aligned in `typography.displayM` with tabular digits; otherwise keep the line as it is.
- **Presets**: Rename (`pencil`), Copy (`copy-outline`), Delete (`trash-outline`) as `IconButton`s in the row. **Starters**: the court's outer card is a flat panel.
- **Stats** (`SeasonOverview`, `StatsNumbers`, `StatsTable`, `statsTableStyles`): the three season tiles become one panel with three columns divided by a 1 px `border` line; numbers `typography.displayM` tabular, labels eyebrow. Tables: no outer box, header row in eyebrow style, 1 px `border` between rows, tabular digits, fixed first column as now.
- `EmptyState` for: no profiles, no teams, no players, no seasons, no presets, no stats.

**Check.** `teams`, `profiles`, `team-*`, `team2-roster`, `season-*`. Two full rows of roster cards are visible at 375 × 844. German with the dyslexia font: team rows and roster cards don't overflow.

## PR 5 — match screens

**Lineup builder** (`app/match/[matchId]/index.tsx`, `features/lineup/*`):

- Header (compact): title as today; `subtitle` = the season line and the status ("2026/27 · Season · in progress"), joined the way the i18n files already join such parts. `headerRight` = `Button` primary compact, label `t.live.open`, label / `testID` (`open-live`) / action of today's Live link; measure its width for `trailingRoom` as `MembersHeaderButton` does. Remove the two status lines from the page.
- Order on the page: set track (kind `set`), link tiles, notice, formation, court, then everything else in today's order.
- `MatchLinks`: one row of five tiles (Rotation, Starters, Print / PDF, Stats, Performance): flex 1, `minHeight` 56, bg `surface`, `radius.md`, Ionicons 20 in `textMuted` (`sync-outline`, `grid-outline`, `print-outline`, `stats-chart-outline`, `pulse-outline`) over the existing label in `typography.caption` at weight 600, centred, up to two lines, `adjustsFontSizeToFit` with `minimumFontScale` 0.8. Same labels, test IDs and actions; `PrintButton` gets a tile look.
- "This set has been played — reset live data to edit." is a `Banner`, without icon.
- Formation: two `SegmentedTrack`s in one row as today (locked look from PR 3). Rotate buttons: secondary. Serve choice: `SegmentedTrack`. Libero slot: flat panel.
- **Players on the court (owner's wish: more contrast).** `PlayerChip` gets a prop `onCourt`. With it, the default ring colour is `chipRing` instead of `border`, and the circle gets `boxShadow` 0 / 3 / blur 8 in `chipShadow`. A selected or highlighted ring, and the lifted style while dragging, win over it. Set `onCourt` in every court: builder, preset editor, team starters, rotation viewer, starters overview, live. Bench chips don't change. If `boxShadow` doesn't draw on web or Android in this React Native version, use `shadow*` plus `elevation` and say so.
- Target: at 390 × 844, EN, dark, the bottom edge of the "Who serves first" control is at or above 844 without scrolling. Measure it with Playwright and give the number in the PR.

**Rotation viewer**: Previous / Next are round `IconButton`s on `surface` (`chevron-back` / `chevron-forward`, today's labels); the title on one line in `typography.displayM` with `adjustsFontSizeToFit`; rotations 1–6 as a `SegmentedTrack` (kind `choice`); the set picker as kind `set`.

**Live** (`features/live/*`):

- Header right button: secondary. Set track kind `set`.
- `Scoreboard`: bg `surface`, `radius.xl`, no border. The "Set 1" / "Sets 0:0" line and the team names in eyebrow style (names in `text`); the serving dot stays `highlight`; the score in `typography.score` (today `SCORE_FONT_SIZE` = 64 in `features/live/layout.ts`, platform font); the serve line and the rotation line keep their colours.
- `PointButtons`: `radius.lg`, label `typography.displayL`; heights unchanged (88, and 64 while "Who serves first" shows).
- Undo: secondary, flex 1, icon `arrow-undo`. Reset live data: `dangerQuiet`. Substitution: secondary. Tag chips: pill, `surfaceRaised`, selected `primarySoft`.
- **Height rule** (DECISIONS #75, #126, #212): measure today's bottom edge of the Substitution button for `live-current` and `live-set1` at 390 × 844 in EN and DE, font off and on. After the change it must not be lower. If the scoreboard got taller, lower the score size (not below 80).

**Performance**: cards are flat panels; `RatingBadge` is a soft chip (positive: `secondarySoft` + `secondaryText`; negative: `surfaceRaised` + `error`; neutral: `surfaceRaised` + `textMuted`) with today's text and symbol. **Match stats**: as the team stats.

**Check.** `builder-*`, `preset`, `team-starters-editor`, `rotation`, `match-starters`, `live-*`, `performance*`, `match-stats`. Drag and drop and tap-to-place still work in the builder (run the existing flows in the browser with mouse and touch).

## PR 6 — player, forms, Settings, Profile, account

- **Player** (`features/playerDetail/*`): the name is the large header title, so `PlayerHeader` drops its own name text and shows the avatar at 96 px, "#7 · Active", the badges and Edit (secondary). `SeasonStats`: one flat panel. The first three values (today's first three tiles) are large: number `typography.displayL` tabular, label eyebrow. The others follow as a three-column grid without boxes, a 1 px `border` line between rows, numbers `typography.heading` tabular, labels `typography.caption` `textMuted`. Same values, labels and order. Match rows and the description: flat panels.
- **Forms** (player, team, profile, match, season): fields on the page with the new `TextField`; Save primary, Cancel secondary, Delete `dangerQuiet` and set apart from the other two. Same order of fields, same test IDs.
- **Settings and Profile**: sections as in PR 3. Only the main action of the screen is solid orange ("Export everything"); Import and the other buttons secondary; "Delete all data" `danger`. Profile card: avatar 72, "Signed in as" as eyebrow, the name in `typography.displayL`.
- **Sign-in** (`features/account/SignInScreen`, `CodeStep`): `assets/images/icon.png` at 56 px above the text; the email field 52 px high; "Send code" primary, full width; "I already have a code" ghost. The code field: `fontSize.xxl`, `letterSpacing` 6, tabular digits, centred. Keep every autofill and keyboard prop. No logic change.
- Cloud sync, Cloud teams, Members, Join, the sync dialogs: shared parts only, `EmptyState` for their "empty" strings.

**Check.** `player-*`, `match-new`, `season-new`, `settings`, `profile`, `account`, `sign-in`, plus Members and Join opened by hand.

## PR 7 — motion, full check, docs, version

- **Motion**, all off with the OS "reduce motion" setting (read it the way `SlideTransition` does); a tap is never delayed:
  - Press feedback on `Button`, `ListRow`, `PlayerCard`, link tiles, tab items: scale to 0.97 in 100 ms, back in 160 ms, plus today's opacity.
  - `PillTabBar`: the soft marker slides to the new item with `withSpring({ stiffness: 380, damping: 31, mass: 1 })`.
  - `Scoreboard`: the number that changed scales 1 → 1.12 in 90 ms and springs back with the same spring.
- **Full check**: all screenshots; look at contact sheets of every screen in EN and DE, both themes, font off and on, at 375 and 1280 px. A Playwright script that fails when an element with role button, tab, switch or checkbox is smaller than 44 × 44 (count `hitSlop` where used). The QA agent goes through PLAN §47.
- **Docs**: tick PLAN §47; `docs/README_LEGACY.md` version history 11.0.0; the "What's new" line in `README.md`; `/wrap-up` for HANDOFF.
- **Version**: 11.0.0 in `app.json` and `package.json`, then `npm install --package-lock-only`.
- **Test build**: after the merge run the workflow `android-apk.yml` on `main` with `release: false`. Give the owner the link to the APK artifact and the list of what to try on the phone: start-up (fonts), header and back on every level, the bottom bar and its swipe, a drag in the lineup builder, a live set, light theme, dyslexia font, German. **Do not publish a release.** Stop and wait for the owner.

## Acceptance list (PLAN §47)

- [ ] No screen has the grey header bar; every screen shows its title once; Back is a round button and works after a reload.
- [ ] Solid orange appears only on the court, the "Point us" button and one main action per screen (profile and team avatars keep their own colours).
- [ ] Titles, scores and roster numbers use Barlow Condensed; scores and stat numbers have equal-width digits; with the dyslexia font on, no text uses Barlow and no label is in capitals.
- [ ] Panels, rows and cards have no outline in either theme; all new colour pairs pass AA (test).
- [ ] The app tabs and the team tabs use the same pill bar; swipe and tap between tabs work as before.
- [ ] Edit, Delete, Rename and Copy are icon buttons with their old accessible names; Delete still asks.
- [ ] Lineup builder: Live is in the header; five link tiles; the notice is a banner without icon; players on the court have the ring and shadow; "Who serves first" is visible at 390 × 844.
- [ ] Live: the Substitution button is not lower than in 10.0.1 at 390 × 844 (EN, DE, font off and on).
- [ ] Empty lists show the court drawing and the existing sentence.
- [ ] Every interactive element is at least 44 × 44; labels start with the visible text (guard test).
- [ ] EN and DE at 375 px, both themes, with and without the dyslexia font: nothing overflows or is cut without "…".
- [ ] No feature, text, stored-data or sync change: store 13, export 10, golden byte-equal, no diff under `src/lib/sync`, `src/domain`, `supabase/`.
- [ ] Lint, typecheck and tests pass in CI; the web export builds.
- [ ] The owner tried the test build on the phone. Only then: release.

## Report at the end

Per PR: link, what changed, what was checked and how, what could not be checked. Then the test build link and the open questions.
