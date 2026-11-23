# Volley Lineup — Project Plan

## 1. Vision

A mobile + web app for volleyball team managers to manage their roster, build starting lineups for each set with simple drag and drop, and see the rotation for every set. Everything is stored locally on the device; data moves between devices with JSON export/import.

**Platforms:** iOS, Android, Web — one codebase.
**Users (v1):** team managers only.
**Backend:** none. All data stays on the device.

## 2. Assumptions (confirm or change before building)

- Indoor volleyball, 6 vs 6, court positions 1–6.
- Up to 5 sets per match.
- One libero per set (optional).
- "Accounts" = **local manager profiles** on the device (name + optional avatar colour). No passwords in v1: without a server, a password on local storage gives no real security. Data is shared between devices only through export/import.
- App language: English (strings kept in one file so German can be added later).

## 3. Features

### v1 (must have)

1. **Manager profiles** — create, select, rename, delete a local profile. Each profile owns its teams.
2. **Teams** — create, rename, delete teams (e.g. "Herren 1", season 2026/27).
3. **Roster** — add, edit, delete players: first name, last name, jersey number (unique per team), positions (Setter, Outside Hitter, Middle Blocker, Opposite, Libero, Defensive Specialist), active/injured flag.
4. **Matches** — create a match (opponent, date, home/away) inside a team.
5. **Lineup builder (per set)**
   - Court view with 6 slots (positions 1–6) + a bench list of all active players.
   - Drag a player from the bench onto a slot; drag between slots to swap; drag back to the bench to remove.
   - Tap-to-select fallback: tap a player, then tap a slot (for accessibility and small screens).
   - Libero slot next to the court.
   - Set tabs 1–5; "Copy lineup from previous set" button.
   - Choose who serves first in the set (us / opponent).
   - Validation: 6 different players, a player in only one slot, libero not in the 6 starting slots, warnings (not blocking) for missing setter / unusual position layout.
6. **Rotation viewer**
   - Steps through rotations 1–6 for the selected set (buttons + swipe).
   - Shows the front row (4, 3, 2) and back row (5, 6, 1), with the server (position 1) highlighted.
   - Shows player number, name and position badge on each spot.
7. **Starters overview** — one screen per match showing the starting six + libero for every set side by side.
8. **Export / import**
   - Export everything, or one team, as a `.json` file (download on web, share sheet on phone).
   - Import from a file, with a preview ("3 teams, 24 players") and a choice of merging or replacing.
   - A schema version in the file, validated on import; a bad file shows a clear error and never corrupts existing data.
9. **Persistence** — data survives app restarts and page reloads.

### Later (v2+ ideas, NOT in v1)

- Automatic libero swaps in the rotation view (libero replaces a chosen back-row player).
- Live match mode: tap "point won / lost" to rotate automatically, with a score per set.
- Substitution tracking (6 per set).
- 5-1 / 6-2 system templates.
- German translation.
- Cloud sync with a real backend and real accounts.
- Printable / PDF lineup sheet.

## 4. Rotation rules (domain logic)

- Positions: 1 = back right (server), 2 = front right, 3 = front middle, 4 = front left, 5 = back left, 6 = back middle.
- Rotating (after a side-out) moves each player clockwise: 2→1, 3→2, 4→3, 5→4, 6→5, 1→6.
- Rotation 1 = the starting lineup; rotations 2–6 follow by repeating the rule above.
- Front row = positions 2, 3, 4. Back row = 1, 5, 6.
- All of this lives in pure functions (`src/domain/rotation.ts`) with full unit tests.

## 5. Tech stack

| Area          | Choice                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Framework     | Expo (latest stable SDK) + React Native + react-native-web                                          |
| Language      | TypeScript (strict)                                                                                 |
| Navigation    | Expo Router                                                                                         |
| Drag & drop   | react-native-gesture-handler + react-native-reanimated                                              |
| State         | Zustand with `persist` middleware                                                                   |
| Storage       | @react-native-async-storage/async-storage (uses localStorage on web)                                |
| Validation    | zod (import files + forms)                                                                          |
| Export/import | expo-file-system + expo-sharing + expo-document-picker on phones; Blob download + file input on web |
| IDs           | nanoid / expo-crypto `randomUUID`                                                                   |
| Tests         | Jest (jest-expo) + React Native Testing Library                                                     |
| Lint/format   | ESLint + Prettier                                                                                   |
| CI            | GitHub Actions: lint, typecheck, test, web export                                                   |
| Web hosting   | GitHub Pages (via Actions, `expo export -p web`, base URL set for the repo path)                    |
| Phone testing | Expo Go (QR code)                                                                                   |

## 6. Data model

```ts
type Position = 'S' | 'OH' | 'MB' | 'OPP' | 'L' | 'DS';

interface ManagerProfile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  number: number; // unique within team
  positions: Position[]; // first = primary
  active: boolean;
}

interface Team {
  id: string;
  profileId: string;
  name: string;
  season?: string;
  createdAt: string;
}

interface Match {
  id: string;
  teamId: string;
  opponent: string;
  date: string;
  home: boolean;
  sets: SetLineup[]; // length 1–5
}

interface SetLineup {
  setNumber: 1 | 2 | 3 | 4 | 5;
  slots: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>; // court position -> playerId
  liberoId: string | null;
  weServeFirst: boolean;
}

interface ExportFile {
  app: 'volley-lineup';
  schemaVersion: 1;
  exportedAt: string;
  profiles: ManagerProfile[];
  teams: Team[];
  players: Player[];
  matches: Match[];
}
```

## 7. Screens

1. **Profile picker** — list of profiles + "New profile".
2. **Teams** — the profile's teams.
3. **Team** — tabs: Roster | Matches.
4. **Player editor** — form (modal).
5. **Match** — set tabs 1–5 → Lineup builder; buttons for Rotation viewer and Starters overview.
6. **Lineup builder** — court + bench, drag and drop.
7. **Rotation viewer** — court, rotation 1–6 stepper.
8. **Starters overview** — all sets side by side.
9. **Settings** — switch profile, export, import, delete all data, app version.

Layout: on phones, the court is on top and the bench is a scrollable list below. On wide screens (web/tablet), the court is on the left and the bench on the right.

## 8. Design

- **Dark theme** by default.
- Colours (design tokens in `src/theme/colors.ts`):
  - Black background `#0D0D0D`, surface `#1A1A1A`, border `#2A2A2A`
  - Orange (primary, buttons, active states) `#FF6B00`
  - Volleyball yellow (highlights, the server, the selected set) `#FFC72C`
  - Volleyball blue (secondary, front row, links) `#0057B8` (use a lighter `#3D8BFF` for text on black)
  - Text `#FFFFFF`, muted text `#A0A0A0`, error `#FF4D4F`
- The court is drawn in orange with a white net line; player chips are round with the jersey number large, the name small, and the position badge coloured.
- All text must meet WCAG AA contrast. Touch targets are at least 44×44 px.
- Clear visual feedback while dragging: the lifted chip grows, and valid drop slots glow yellow.

## 9. Milestones

| #   | Milestone                           | Done when                                                                         |
| --- | ----------------------------------- | --------------------------------------------------------------------------------- |
| M0  | Scaffold                            | App runs on web + Expo Go, theme, navigation shell, store, CI is green            |
| M1  | Profiles, teams & roster            | CRUD works and persists                                                           |
| M2  | Rotation domain logic               | Pure functions + 100% unit test coverage                                          |
| M3  | Lineup builder                      | Drag and drop + tap fallback work on web and phone; validation                    |
| M4  | Rotation viewer + starters overview | All 6 rotations are correct for every set                                         |
| M5  | Export / import                     | Round trip export → wipe → import restores identical data; bad files are rejected |
| M6  | Polish + review                     | Independent review passed, README written, web deployed to GitHub Pages           |

## 10. Acceptance checklist (v1)

- [x] Create a profile, a team, 12 players, a match with 5 sets, all with no errors.
- [x] Drag and drop works with a mouse (web), touch (phone), and tap-to-select. — _Mouse, emulated touch and tap verified in a browser; native touch drag in Expo Go still needs a manual check on a real phone._
- [x] A player can't be placed twice in the same set.
- [x] The rotation viewer shows correct positions for all 6 rotations (verified by tests).
- [x] Reloading the page / restarting the app keeps all data.
- [x] Exporting, deleting all data and importing restores everything exactly.
- [x] Importing a broken or foreign JSON file shows an error and changes nothing.
- [ ] Lint, typecheck and tests pass in CI; the web build is live on GitHub Pages. — _CI green ✅; Pages deploy workflow ready but GitHub Pages must be enabled by the repo owner (private repo, see DECISIONS #49)._
- [x] The app looks right on a small phone (375 px wide) and on desktop.

---

# v2 plan

v1 shipped as `v1.0.0`. v2 adds the "Later" ideas from §3, except cloud sync (needs a backend and accounts; out of scope, see DECISIONS).

## 11. v2 features

1. **Libero swaps (rotation view)** — per set, choose which starters the libero replaces (default suggestion: the primary middle blockers). In the rotation viewer, whenever one of those players is in the back row (positions 1, 5, 6) the libero is shown in their spot (marked "L for #n"), except when that player is serving at position 1 (the libero may not serve). Toggle in the viewer to show the base lineup without swaps.
2. **5-1 / 6-2 templates (lineup builder)** — "Fill from template" picks a system (5-1 or 6-2) and fills the six slots from the roster by primary position, keeping the standard layout (setter opposite opposite / two setters opposite; outsides opposite; middles opposite). Uses only active players; never places a player twice; shows which slots couldn't be filled.
3. **Live match mode** — per set: big "Point us" / "Point them" buttons, running score, current rotation (side-out rule: when we win a rally on the opponent's serve we rotate clockwise; when we win on our serve we don't), who is serving, undo last action. Set ends are not enforced (manager decides), but the score shows "set point" at 24+ with a 2-point lead (15 in set 5).
4. **Substitution tracking** — in live mode, substitute a player on court for a bench player (6 substitutions per set; the second sub of a pair must bring back the original starter in the same position — show a warning, not a block, if violated). Libero replacements don't count as substitutions. Shows "subs used: n/6".
5. **Printable lineup sheet** — a print view of a match: all sets' starting six in court layout, libero, who serves first, roster with numbers. Web: browser print (`window.print`) with a print stylesheet; phone: `expo-print` → PDF via the share sheet.
6. **German translation** — `src/i18n/de.ts` with the same shape as `en.ts` (TypeScript enforces completeness); language switch in Settings (persisted, default English).

## 12. v2 data model changes

```ts
interface SetLineup {
  // ...v1 fields...
  liberoReplaces: string[]; // starters the libero replaces in the back row
  events: SetEvent[]; // live log; score, rotation and line-up are derived from it
}
type Side = 'us' | 'them';
type SetEvent =
  { type: 'point'; winner: Side } | { type: 'sub'; outPlayerId: string; inPlayerId: string };
// ExportFile.schemaVersion: 2 (v1 files are upgraded on import)
// Store: version 2 (v1 data migrated), plus `language: 'en' | 'de'` (not exported)
```

Derived live state is computed by a pure function (`src/domain/liveSet.ts`): `replaySet(set, players) → { score, rotationSlots, servingSide, server, subsUsed, onCourt, warnings }`. Undo = drop the last event.

## 13. v2 acceptance checklist

- [x] Choosing whom the libero replaces shows the libero in the right back-row spots in all 6 rotations, never at the serving position 1 (verified by tests).
- [x] 5-1 and 6-2 templates fill a valid lineup from a 12-player roster, and leave slots empty (with a message) when positions are missing.
- [x] Live mode: scoring a full set with side-outs produces the correct score, rotation and server after every rally (verified by tests); undo works.
- [x] Substitutions: 6 per set max, counter correct, the re-entry rule warning appears; libero swaps don't count.
- [x] Print view shows every set + libero + serve info; prints on web and produces a PDF on the phone. — _web verified (browser print + A4 PDF); the phone PDF (`expo-print`) is unit-tested only and needs a manual check on a device._
- [x] The whole app can be switched to German and back; the choice survives a restart.
- [x] v1 data on a device and v1 export files open in v2 without loss.
- [x] Lint, typecheck and tests pass in CI; `src/domain` 100% coverage.

---

# v2.2 additions

## 14. Team nav bar, presets and starters

- In the team view a bottom nav bar: **Roster · Matches · Presets · Starters**.
- **Starters**: the team's usual starting six + libero (+ whom the libero replaces). New matches start set 1 with them.
- **Presets**: named lineups for the team, edited with the lineup builder; in a match set: "Use team starters" / "Apply preset…".

Data model v3:

```ts
interface LineupPreset {
  id: string;
  teamId: string;
  name: string;
  kind: 'starters' | 'preset'; // at most one 'starters' per team
  slots: Record<1 | 2 | 3 | 4 | 5 | 6, string | null>;
  liberoId: string | null;
  liberoReplaces: string[];
  createdAt: string;
}
// ExportFile: + presets: LineupPreset[], schemaVersion: 3 (v1/v2 files upgraded on import)
// Store: version 3 (v2 → v3 adds presets: [])
```

---

# v3 plan — Match day & stats

v2.2 shipped as `v2.2.0`. v3 makes live mode follow a whole match, adds statistics derived from the event log, and optional point tagging.

## 15. v3 features

1. **Whole-match live mode**
   - Live mode follows the match, not one set: the set score (e.g. 2:1) is shown next to the rally score.
   - A set is won at 25 (15 in set 5) with a 2-point lead. Then live mode shows "Set won by us / them" with **Start set N+1** and **Undo last point** (no more rallies in a won set).
   - Starting the next set opens its lineup. If that set is empty, the manager picks: team starters / a preset / a copy of the previous set. The serve choice for the new set is asked there, then live mode continues with it.
   - The match ends when a side has won 3 sets (best of 5). Live mode then shows a **match summary**: final result, the score of every set, and the duration when timestamps exist.
   - Undo works across a set end: undoing the winning point re-opens the set.
   - The match list and the match header show the result: "3:1 won", "1:3 lost", "in progress" (or nothing when not started).
2. **Statistics** (from data already recorded; no extra input)
   - Per set and per match: points won / lost in each of the 6 rotations, side-out % per rotation (rallies won when receiving ÷ rallies received), break points per rotation (points won on our serve).
   - Per player, for a match and for the team's season: sets started, sets played, times subbed in / out, serve turns, points won on their serve; plus the tag totals from item 3 (kills, aces, blocks, errors).
   - A **Stats** tab in the team nav bar (Roster · Matches · Presets · Starters · Stats) with a season overview (W/L record, set ratio) and per-player tables; a **Stats** button on the match screen for that match.
   - All calculation is pure domain code (`src/domain/stats.ts`) replayed from the event log, 100% tested.
3. **Optional point tagging**
   - After "Point us": optional chips kill / ace / block / opponent error, with a player picker for kill / ace / block. After "Point them": our error (optional player) / their kill / their ace.
   - Never required; one tap (or simply the next rally) skips it. Tags feed per-player stats.
4. **Polish**: "Delete all data" mentions saved lineups; `docs/WORKER_BRIEF.md` is current; the print sheet has an optional "with results" section (set scores) for played matches; everything in English and German.

## 16. v3 data model changes

```ts
/** v4: optional tag of a rally (what decided it). */
type PointKind =
  | 'kill'
  | 'ace'
  | 'block'
  | 'opponentError' // winner: 'us'
  | 'ourError'
  | 'opponentKill'
  | 'opponentAce'; // winner: 'them'
type SetEvent =
  | {
      type: 'point';
      winner: Side;
      kind?: PointKind; // must belong to the winner
      playerId?: string; // only with kill / ace / block / ourError; a player of the team
      at?: string; // ISO time the rally was recorded (match duration)
    }
  | { type: 'sub'; outPlayerId: string; inPlayerId: string };
// ExportFile.schemaVersion: 4 (v1–v3 files upgraded on import; old events stay valid)
// Store: version 4 (v3 → v4 needs no data change; old events stay valid)
```

Set and match results are derived by pure functions (`src/domain/matchState.ts`): `setScore`, `setWinner`, `getMatchState(match) → { sets, setsWon, winner, status, currentSetNumber, durationMs }`. Nothing about the result is stored.

## 17. v3 acceptance checklist

- [x] A full 5-set match can be played in live mode from set 1 to the match summary without leaving live mode, and the set / match results are correct (tests: 3:0, 3:2 with a 15-point tiebreak, deuce sets).
- [x] Undo works across a set end (it re-opens the set).
- [x] Rotation stats (points won / lost, side-out %, break points per rotation) are correct for a scripted match (tests with literal expected numbers).
- [x] Player stats are correct for a scripted match with substitutions and libero swaps (tests).
- [x] Point tagging is optional, and its per-player totals are correct.
- [x] v3.0.0 opens v2.x data (store v3) and v1–v3 export files without loss; export / import round trip with tags restores exactly. — _web (localStorage) migration verified in a browser; Android AsyncStorage upgrade covered by unit tests only._
- [x] Phone layout (390×844): live controls and the set / match score fit without scrolling; the stats tables are readable at 375 px. EN + DE. — _verified in a browser at 390×844 / 375 px (Playwright); not yet on a real phone._
- [x] Lint, typecheck and tests pass in CI; `src/domain` 100%.

---

# v3.1 addition

## 18. Names instead of numbers

- A switch in Settings ("Show names instead of numbers") makes the player chips show the player's name in the circle and the jersey number below it. Persisted on the device (store version 5), default off; not part of export files.

---

# v4 plan — Roles on court

Owner request after v3.1: roles on the field, rotate before the set, rotation named after the setter, any player in any role (confirmed, marked), and a libero that replaces chosen roles and can be switched off.

## 19. v4 features

1. **Roles on court** — every starter plays a role (S, OH, MB, OPP, DS). Default: the player's primary position. The role is shown at the top of the court spot (e.g. "S", "OPP") in the lineup builder, the rotation viewer, the starters overview, live mode and the print sheet. Roles follow players through swaps and rotations; in live mode a substitute takes over the role of the player they replace.
2. **Any player, any role** — tap a starter's role to change it (lineup builder and preset / starters editor). A role that is none of the player's positions (primary or secondary, from the roster) asks "Are you sure?" first and shows "*" at the top right of the spot. Roles are locked in a played set (like the starting six).
3. **Rotate before the set** — "Rotate ↻ / ↺" in the lineup builder (and the live next-set setup) moves the whole starting six one position, so the setter can start anywhere. Only before the set is played.
4. **Rotation named after the setter** — the setter at position 4 = "Rotation 4" (rotation viewer, live mode, starters overview, stats per rotation). With two setters (6-2) the back-row setter counts. Without a setter role on court, rotations are counted from the start as before.
5. **Libero** — "Libero replaces": choose roles (Middles / Outsides / Opposite / Setter / DS — sets whom the libero replaces to the starters in those roles; single players can still be toggled). A **"Libero plays"** switch turns the libero off for the set (no swaps anywhere: rotation viewer, live, stats) without removing them.

## 20. v4 data model changes

```ts
type RoleOverrides = Record<string, Position>; // player id → role, only when not their primary position
interface SetLineup {
  /* … */ roles: RoleOverrides;
  liberoActive: boolean;
}
interface LineupPreset {
  /* … */ roles: RoleOverrides;
  liberoActive: boolean;
}
// ExportFile.schemaVersion: 5 (v1–v4 files upgraded: roles {}, liberoActive true)
// Store: version 6 (v5 → v6 adds the same defaults)
```

Pure logic in `src/domain/roles.ts` (`roleOf`, `isOffPosition`, `setRole`, `rotateStarters`, `setLiberoActive`, `startersWithRoles`, `setterRotation`); the live replay (`liveSet.ts`) tracks roles per rally (`RallyStep.roles`, `setterRotation`; `LiveState.roles`, `setterRotation`); `activeLiberoReplaces(set)` is the only way swaps read whom the libero replaces.

## 21. v4 acceptance checklist

- [x] Each starter's role shows at the top of their spot in the lineup builder, rotation viewer, starters overview, live court and print sheet; changing a role works in matches, presets and team starters; roles follow players through swaps, rotations and substitutions (tests).
- [x] Choosing a role that is none of the player's positions asks for confirmation (cancel keeps the old role) and shows "*" at the top right; a secondary position doesn't (tests).
- [x] Rotate ↻ / ↺ moves the starting six before the set; disabled once played (tests).
- [x] The rotation number follows the setter (setter at 4 = rotation 4, 6-2 back-row setter, fallback without setter) in the rotation viewer, live mode and stats (tests with literal numbers).
- [x] The libero can be set to replace roles (e.g. middles, outsides) and switched off; a switched-off libero never swaps in (rotation, live, stats) (tests).
- [x] v4.0.0 opens v3.x data (store v5) and v1–v4 export files without loss; export / import round trip with roles and the libero switch restores exactly. — _web (localStorage) migration from store v5 verified in a browser; Android AsyncStorage upgrade covered by unit tests only._
- [x] Phone layout 375 px: role tags, asterisks and the new controls fit; EN + DE. — _verified in a browser (Playwright); not yet on a real phone._
- [x] Lint, typecheck and tests pass in CI; `src/domain` 100%.

---

# v5 plan — Formations (roles belong to the court spots)

Owner feedback on v4: roles must be fixed on the court even with nobody on it — two middles, two outsides, setter and opposite (or two setters), always opposite each other — so that e.g. two outsides can never stand next to each other. The volleyball background is in `docs/VOLLEYBALL_RULES.md` (researched from FIVB / DVV / coaching sources); it also lists testable checks for the app.

## 22. v5 features

1. **Formation per set** (and per preset / team starters): system **5-1** or **6-2** and the order around the court — setter followed by an **outside** (S · OH · MB · OPP · OH · MB, the textbook order) or by a **middle** (S · MB · OH · OPP · MB · OH); in a 6-2 the opposite spot is the second setter. The pairs 1–4, 2–5, 3–6 always have the same kind of role. The formation is fixed: single spots can't be changed (owner's choice).
2. **Roles on every spot, also when empty** — every court (lineup builder, rotation viewer, starters overview, team starters, live court, print sheet) shows each spot's role at the top. Players are dragged / tapped onto spots and play that spot's role.
3. **Off position** — placing a player on a spot whose role is none of their listed positions asks "Are you sure?" first (Cancel = nothing moves) and marks the spot with "*" at the top right.
4. **Rotate before the set** turns the formation together with the players (everyone keeps their role); the rotation number follows the setter's spot (setter on 4 = rotation 4; 6-2: the back-row setter), also on an incomplete court.
5. **Templates** fill players into the formation by role; choosing 5-1 / 6-2 sets the formation's system.
6. **Rules checks** from `docs/VOLLEYBALL_RULES.md`: point tags only offer plausible players (block: front-row, not the libero; ace: the server; kill: not the libero), "no setter" means no listed setter on the setter spot.

## 23. v5 data model changes

```ts
interface Formation {
  system: '5-1' | '6-2';
  order: 'outside' | 'middle';
  setterAt: 1 | 2 | 3 | 4 | 5 | 6;
}
interface SetLineup {
  /* … */ formation: Formation;
  liberoActive: boolean;
} // `roles` removed
interface LineupPreset {
  /* … */ formation: Formation;
  liberoActive: boolean;
} // `roles` removed
// ExportFile.schemaVersion: 6 (v5 files: per-player roles → a formation inferred from where the setter stands)
// Store: version 7 (same conversion)
```

`src/domain/roles.ts`: `FORMATION_PATTERNS`, `spotRole`, `spotRoles`, `roleOf(set, playerId)`, `isOffPosition`, `setFormation`, `rotateStarters`, `formationRotation`, `inferFormation`, `upgradeLineupToFormation`.

## 24. v5 acceptance checklist

- [x] Every court shows the formation's roles on all six spots, also when empty; the pairs are always opposite (5-1 / 6-2, both orders) — tests with literal layouts.
- [x] Changing system / order in the builder (matches, presets, team starters) and in the live next-set setup; locked once a set is played.
- [x] Placing a player on a spot that isn't one of their positions asks for confirmation (drag & drop and tap-to-select; Cancel moves nothing) and shows "*" at the top right; a listed secondary position doesn't.
- [x] Rotate moves players and formation together; the rotation number follows the setter spot (also incomplete courts).
- [x] v4 data (store v6) and v1–v5 files open; per-player roles become the matching formation (setter position kept); export / import round trip restores exactly. — _web (localStorage) migration from store v6 verified in a browser; Android AsyncStorage covered by unit tests only._
- [x] Point tags offer only plausible players (rules doc checks #35); the rules doc's check list is updated with PASS for everything the app now models.
- [x] Phone 375 px EN + DE: role tags on empty spots and the formation controls fit. — _verified in a browser (Playwright); not yet on a real phone._
- [x] Lint, typecheck, tests in CI; `src/domain` 100%.

---

# v6 plan — Players & performance

v5 shipped as `v5.0.0`. v6 adds pictures, a player detail screen with season stats, confidential player descriptions, a performance view per set / match, and error types on "our error". Owner's choices (asked before building): photos **are** exported; descriptions are exported **only when chosen** at export time; **7 error types**.

## 25. v6 features

1. **Profile pictures** — each manager profile and each player can have a photo: take one with the camera or pick one from the gallery, change it, remove it. Pictures are resized and compressed on the device (256 px, JPEG 0.7). Without a photo the fallback stays (coloured avatar for profiles, jersey number for players). Shown on the profile, in the roster, on the player detail screen, in the player picker / bench; court chips keep the number or name (`chipLabel` setting) with at most a small photo where it fits at 375 px.
2. **Player detail screen** (tap a player in the roster): photo, name, number, positions, status, and season stats — sets started and played, rallies on court (including as libero) also as "x of y rallies", subs in / out, serve turns, serves and points on serve, kills, aces, blocks, errors (by type), plus/minus while on court. A per-match list with the same numbers; tapping a match opens the performance view of that match for this player. "Edit" opens the existing player form.
3. **Confidential descriptions** — every player can have a free-text description (≤ 1000 characters). Hidden by default everywhere. "Show descriptions" unlocks them with the phone's biometrics or device PIN (`expo-local-authentication`); where that isn't available (web, no biometrics / PIN set up) a confirmation dialog is used instead. Once unlocked, all descriptions stay visible until "Lock" is pressed, the app goes to the background, or it restarts. The unlock state is never persisted. Descriptions never appear in lists, previews or the print sheet; export files contain them only if "Include descriptions" is ticked (only offered while unlocked, off by default).
4. **Performance view** (`/match/[matchId]/performance`, a "Performance" link on the match screen for the selected set): per player rallies on court, won – lost (plus/minus), kills / aces / blocks vs errors (net points) and a one-glance rating. Switch between every played set and "All sets". Tapping a player shows their detail for that set / all sets: error rate (errors per rally on court), errors per action, serve / attack error rates, and errors by type ("3 reception errors, 5 attack errors").
5. **Error types** — the optional tag "Our error" gets an optional error type: Serve · Reception · Attack · Block · Set · Net / foul · Other. Still optional, one tap to skip; no type = "unspecified". Only plausible types / players are offered (`docs/VOLLEYBALL_RULES.md` §7).

## 26. v6 data model changes

```ts
interface ManagerProfile {
  /* … */ photoId?: string;
}
interface Player {
  /* … */ photoId?: string;
  description?: string;
} // description: trimmed, 1–1000 chars
interface Photo {
  id: string;
  dataUri: string;
} // data:image/jpeg;base64,… (≤ 200 000 chars)
type ErrorType = 'serve' | 'reception' | 'attack' | 'block' | 'set' | 'netFault' | 'other';
interface PointEvent {
  /* … */ errorType?: ErrorType;
} // only with kind 'ourError'
interface ExportFile {
  schemaVersion: 7;
  /* … */ photos: Photo[];
} // v1–v6 files upgraded (photos: [])
// Store: version 8 (v7 → v8 changes no data: the new fields are optional).
// Photos live outside the main store: one storage key per photo (src/store/photoStore.ts).
```

Pure logic: `src/domain/photos.ts` (data URI and description rules, referenced photos), `src/domain/performance.ts` (`setPerformance`, `matchPerformance`, `playerSeason`, `performanceRows`, `plusMinus`, `netPoints`, `rating`, `errorRate`, `errorsPerAction`, `serveErrorRate`, `attackErrorRate`, `errorBreakdown`), `pointTags.ts` (`setLastErrorType`, `kindTakesErrorType`), `lastRally.ts` (`plausibleErrorTypes`, error-type-aware `plausiblePlayerIds`).

## 27. v6 acceptance checklist

- [x] Manager and player photos can be added (camera / gallery), changed and removed. They show in the profile, roster, player detail and pickers, with a fallback without a photo. They persist and the store stays small (tests for the domain parts; browser check on web). — _web verified (file input, Playwright, 375 / 1280 px); camera and native permission prompts not tested on a real phone._
- [x] Player detail screen shows season and per-match stats, including points / sets on court, correct for a scripted season with subs and libero swaps (tests with literal numbers).
- [x] Descriptions are hidden until unlocked (biometrics / PIN on phones, confirmation on web). Unlocking shows all descriptions until locked again, the app goes to the background, or it restarts. Nothing confidential shows in lists, print or (per decision) export. — _web verified (confirmation dialog, hidden tab, reload); biometrics / device PIN and backgrounding on a phone covered by unit tests only._
- [x] The performance tab shows every player for each set and for all sets. Player per-set detail shows the error rate and errors by type, correct for a scripted match (tests with literal numbers).
- [x] The error type on "our error" is optional; old data and v1–v6 export files open without loss; export/import round trip restores exactly. — _v5.0 store (version 7) and v1 / v4 / v5 / v6 files checked in a browser; Android AsyncStorage upgrade covered by unit tests only._
- [x] Phone layout 375 px, EN + DE. — _verified in a browser (Playwright, 375×812 / 390×844); not yet on a real phone._
- [x] Lint, typecheck and tests pass in CI; src/domain at 100%.

---

# v7 plan — Seasons & tournaments

Owner request after v6.2: a separate "season box". You create a season (or tournament), make the matches inside it, and add the teams you are going to play, so seasons and their opponents are easy to look through. Owner's choices: every match belongs to a season; opponents are picked from the season's list or typed (a new name is added); the season screen shows season stats, a record per opponent, and optional dates / place.

## 28. v7 features

1. **Seasons / tournaments per team**: name (unique in the team), kind (season or tournament), optional start / end date and place. The team's Matches tab becomes a list of season boxes (newest first) with "New season"; each box shows the name, kind, dates / place and the record (W–L, matches).
2. **Season screen** (`/team/[teamId]/season/[seasonId]`) with three tabs:
   - **Matches**: the season's matches with search (v6.2) and "New match".
   - **Opponents**: the season's opponent teams with the record against each (played, W–L, in progress, upcoming, sets). Add, rename (renames their matches) or delete opponents (only without matches).
   - **Stats**: the season's record and player stats.
   - Edit and delete the season (deleting asks first and removes its matches).
3. **New match in a season**: pick the opponent from the season's teams, or type a new name, which is added to the season.
4. **Stats tab**: a season switcher (All seasons / each season).
5. **Old data**: every team's existing matches go into one season named after the team's season text (e.g. "2026/27"), or else the years of its matches. Every distinct opponent name becomes an opponent of that season.

## 29. v7 data model changes

```ts
type SeasonKind = 'season' | 'tournament';
interface Season {
  id;
  teamId;
  name;
  kind;
  startDate?;
  endDate?;
  location?;
  createdAt;
}
interface Opponent {
  id;
  seasonId;
  name;
  createdAt;
}
interface Match {
  /* … */ seasonId: string;
  opponentId: string;
  opponent: string;
} // opponent = the name, kept in sync
// ExportFile.schemaVersion 8: + seasons, opponents (v1–v7 files upgraded with `upgradeToSeasons`)
// Store version 9 (same upgrade; deterministic ids `season-<teamId>`, `opp-<seasonId>-<folded name>`)
```

Pure logic: `src/domain/seasons.ts` (`upgradeToSeasons`, `validateSeasonForm`, `validateOpponentName`, `findOpponentByName`, `seasonsForTeam`, `opponentsForSeason`, `opponentRecords`, `opponentHasMatches`, `foldName`).

## 30. v7 acceptance checklist

- [x] Seasons and tournaments can be created, edited and deleted. The team's Matches tab lists them as boxes with their record; a season screen shows its matches (with search), opponents and stats.
- [x] A new match is created inside a season; the opponent is picked from the season's teams or added by typing a new name.
- [x] Opponents can be added, renamed (their matches follow) and deleted when they have no matches. The record per opponent is correct (tests with literal numbers).
- [x] The Stats tab and the season screen show stats for one season (or all seasons).
- [x] Old data (store v8) and v1–v7 export files open without loss: one season per team with all its matches and opponents. Export / import round trip restores exactly. — _web (localStorage) upgrade from store v8 and v1 / v5 / v7 files checked in a browser; Android AsyncStorage covered by unit tests only._
- [x] Phone layout 375 px, EN + DE. — _verified in a browser (Playwright); not yet on a real phone._
- [x] Lint, typecheck and tests pass in CI; src/domain at 100%.

## 31. v8 features — "Look & feel"

1. **Swiss date format.** Every date shows as `dd.mm.yy` (22.11.26) in EN and DE: match lists, match screen, season boxes and dates, player detail, performance, print sheet, stats, import preview. Storage, export files and sorting stay ISO `YYYY-MM-DD` (display only). Date fields (new match, season dates) accept `d.m.yy`, `dd.mm.yyyy` and ISO and start with today as `dd.mm.yy`. One helper: `src/domain/dates.ts` (`formatDate`, `formatOptionalDate`, `parseDateInput`, `todayIso`, `todayInput`; 2-digit years are 20yy). The v6.2 match search still finds "21.11." and "21.11.26".
2. **Smooth transitions.** Switching tabs slides the new tab in from the side of the chosen tab: app tab bar (Teams · Profile · Settings), team nav bar (Roster · Matches · Presets · Starters · Stats), season tabs (Matches · Opponents · Stats), Live ↔ Performance, set filters. A horizontal swipe moves to the next / previous tab wherever there are tabs; never inside the lineup builder's drag & drop area, sideways-scrolling stats tables, the live tag row or text fields. Rotations animate (builder Rotate ↺ / ↻, next-set setup, rotation viewer steps, live side-out): every player slides from the old spot to the new one, with role and "*". Reanimated; about 200–300 ms; reduce motion → instant changes; taps never blocked.
3. **New app icon.** The owner's black ball (`assets/source/app-icon-source.png`) on the app orange: app icon, Android adaptive icon (foreground inside the safe zone, orange background, monochrome), splash image and web favicon, generated by a script.
4. **Roster as player cards.** A card grid (2 columns at 375 px, more on wide screens): photo (fallback: jersey number), first name first, number, position badges, active / injured. Tap → player detail. The active / injured toggle stays ≥ 44 px; descriptions never show on cards.
5. **Light / dark mode.** Profile tab: Dark (default, as before) / Light / System. Device setting like `language`: persisted (store v10), kept on "Delete all data", not exported. `src/theme`: `darkColors` / `lightColors` (same tokens; `primaryText` for orange text, `onCourt`), `darkPositionColors` / `lightPositionColors`, `ThemeProvider` + `useTheme()` + `makeStyles(factory)` (styles memoised per theme). Every screen, dialog, court, chip, table and the live screen follows the theme; both palettes meet WCAG AA (tested). The court stays orange; the print sheet keeps its own light theme.
6. **Dyslexia-friendly font.** Profile tab toggle. All app text uses OpenDyslexic (SIL OFL, bundled via expo-font, offline) when on — Dyslexie is commercial and the owner chose OpenDyslexic. `makeStyles` gives every text style the font family (bold styles the bold family). Device setting (store v10), not exported. Layouts still fit at 375 px.
7. **First name first.** Wherever a player is named, the first name comes first and is kept when space is short: court chips with names on show the first name, "#7 Anna", tag pickers, bench, performance cards, player detail, roster cards, print sheet. The last name's initial (or the whole last name when the initials clash too) only when teammates share a first name. `src/domain/playerNames.ts` (`fullName`, `shortName`, `shortNames`, `numberAndName`). Sorting by jersey number stays.
8. **Team pictures.** A team can have a picture (camera / gallery, change, remove) with the v6 photo picker and photo store (256 px JPEG, own key, pruned when unused). Shown in the team list, the team header and the season boxes; fallback: the team's initial in a coloured circle.

## 32. v8 data model

```ts
interface Team {
  /* … */ photoId?: string;
} // v9 export / app 8.0: the team's picture
// AppState (store v10, device settings — not exported, kept on "Delete all data")
themeMode: 'dark' | 'light' | 'system'; // default 'dark'
dyslexiaFont: boolean; // default false
// ExportFile.schemaVersion: 9 — photos referenced by teams are included; v1–v8 files upgrade
// (v8 → v9 changes nothing). Consistency: every team photo is in the file.
```

Store v9 → v10 adds `themeMode: 'dark'` and `dyslexiaFont: false`. The photo store keeps photos referenced by profiles, players and teams and clears dangling team `photoId`s.

## 33. v8 acceptance checklist

- [x] All dates show as dd.mm.yy (EN + DE); date fields accept dd.mm.yy / dd.mm.yyyy / ISO; storage and exports stay ISO (tests).
- [x] Tab switches slide in the right direction; a horizontal swipe changes tabs (v8.1: the page follows the finger, #214); drag & drop, tables, the tag row and text fields still work; reduce motion turns the slides off. — _checked in a browser with mouse and touch emulation (Playwright); swipe feel not yet checked on a real phone. Reduce motion is read at app start (#208)._
- [x] Rotating (builder, next-set setup, rotation viewer, live side-out) slides every player to their new spot. — _next-set setup shows no court (text only), so nothing slides there (#207)._
- [x] The new icon is used for the app icon, adaptive icon, splash and favicon (checked in the APK workflow and web build). — _web favicon and `expo config` checked; the launcher icon on a real home screen is not yet checked._
- [x] The roster shows player cards (photo or number, name, positions, active / injured), 2 columns at 375 px.
- [x] A light / dark toggle in the Profile tab switches the whole app, persists, and meets AA contrast in both themes.
- [x] A dyslexia-font toggle switches all text to the dyslexia font, persists, and layouts still fit at 375 px. — _browser only; native font rendering not yet checked on a phone._
- [x] First names come first everywhere names are shown; duplicates are told apart (tests).
- [x] Teams can have a picture (add / change / remove), shown in the team list and header; old data and v1–v8 export files open without loss; round trip restores exactly.
- [x] Lint, typecheck and tests pass in CI; src/domain at 100%.

## 34. v8.3 — "Code health" (no visible change)

A review-and-improve release: better performance and easier future work, with **no change the user can see or
notice** — same screens, texts (EN + DE), layouts, animations, gestures, themes and fonts; same stored data (store
**10**, no migration); same export files (`schemaVersion` **9**; the same input gives the same output except
`exportedAt`); old data and v1–v9 files still open. Screen-reader-only label fixes are allowed. The findings, their
ranking and what was skipped (with reasons) are in `docs/AUDIT.md`.

**Proof of "no change"** (every PR):

- `src/domain/__golden__/exportGolden.test.ts`: a fixed data set exports byte for byte as in 8.2.0 (all / one team /
  without descriptions), and v1–v9 files import, replace and merge to the same data (golden files written from 8.2.0).
- `scripts/screenshots.js`: 31 screens × 375 / 1280 px × EN / DE × dark / light × dyslexia font off / on (496 images)
  from a web build, compared with ImageMagick `compare -metric AE` against the 8.2.0 baseline: 0 differing pixels, or
  each difference explained.
- Lint, format, typecheck and tests pass; `src/domain` stays at 100 %; no test is weakened or deleted (moving or
  splitting tests keeps their assertions; tests of deleted dead code go with it).
- Performance changes: before / after numbers (render counts, live screen point-to-paint at 4–6× CPU throttling,
  bundle size).

**Tasks**

1. **Foundation** (orchestrator): golden test, screenshot script, `docs/AUDIT.md`; tooling — Prettier as its own
   `format:check` step (not inside ESLint), ESLint cache, `import/namespace` off, five extra tsc flags
   (`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`,
   `noUnusedParameters`), CI as three parallel jobs with ESLint / Jest caches, the Pages deploy no longer repeats the
   checks, `eslint-plugin-prettier` removed.
2. **Performance** (A): identity-cached domain results (`getMatchState`, `setStats`, `setPerformance`,
   `replaySteps`) so screens hidden under live mode stop recomputing every match on each point; stable gesture
   configs in the pager and `NoTabSwipe`; `SeasonsTab` passes stable arrays; memoised `Stack.Screen` options.
3. **Domain and store** (B): split `exportSchema.ts`, `seasons.ts`, `lineupSheet.ts`, `tabMotion.ts` and (after A)
   `liveSet.ts` by responsibility behind the same import paths; one `legacyData.ts` for the store migrations and
   export upgrades; dead code and unused i18n keys removed; zod out of `roster.ts` if it shrinks the startup bundle;
   shared constants (court rows, `pad2`, `POINT_KINDS`); fewer casts in domain / store / lib; stale comments.
4. **Components and hooks** (C): one `Dialog` shell for the six modals; one set chip filter; generic tab parser;
   `MatchForm` into `features/matchForm`; components and screens over ~150 lines split as pure extracts; fewer casts
   and suppressions; last, the shared UI kit moves from `features/roster/components` to `src/components`.
5. **Accessibility, tests, docs** (D): accessible names start with the visible text (EN + DE) plus a guard test;
   shared test helpers (`src/test-utils`); `docs/WORKER_BRIEF.md` rewritten for v8.
6. **QA** over the v8 checklist (§33) and release 8.3.0 (DECISIONS, README development section, HANDOFF).

## 35. v8.3 acceptance checklist

- [ ] docs/AUDIT.md lists the findings, ranked, with what was done and what was skipped (and why).
- [ ] Before/after screenshots of every main screen are pixel-identical (375 + 1280, EN + DE, dark + light, dyslexia font).
- [ ] Export golden test: identical output except `exportedAt`; old data and v1–v9 files open.
- [ ] Measured improvements where performance work was done (numbers in the PR and AUDIT.md).
- [ ] No component over ~150 lines without a recorded reason; the big domain files are split.
- [ ] Fewer `as` casts and lint/type suppressions (before → after counts).
- [ ] WORKER_BRIEF.md and HANDOFF §3 are current.
- [ ] Lint, typecheck and tests pass in CI; src/domain at 100%; test count not lower.
