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

- [x] docs/AUDIT.md lists the findings, ranked, with what was done and what was skipped (and why).
- [x] Before/after screenshots of every main screen are pixel-identical (375 + 1280, EN + DE, dark + light, dyslexia font).
- [x] Export golden test: identical output except `exportedAt`; old data and v1–v9 files open.
- [x] Measured improvements where performance work was done (numbers in the PR and AUDIT.md).
- [x] No component over ~150 lines without a recorded reason; the big domain files are split.
- [x] Fewer `as` casts and lint/type suppressions (before → after counts).
- [x] WORKER_BRIEF.md and HANDOFF §3 are current.
- [x] Lint, typecheck and tests pass in CI; src/domain at 100%; test count not lower. (QA on main 3e5c3a3: 117 suites / 1442 tests vs 1198; 496 screenshots / 0 px; golden + legacy v1–v9 + store v9 data identical in both builds; only screen-reader labels changed, 127 pairs, all start with the visible text.)

## 36. v8.4 — owner polish

1. Team tabs (Roster · Matches · Presets): room between the top button row and the cards below.
2. Court chips: the player's picture faded behind the number (or name), so the number stays clear.
3. Settings → Player chips: the switch reads "Prioritise names" (DE "Namen bevorzugen").

No data change (store 10, export 9).

## 37. v8.4 acceptance checklist

- [x] The add buttons on Roster, Matches and Presets no longer touch the cards (375 + 1280, EN + DE, dark + light, font).
- [x] Court chips of players with a photo show it faded behind the number / name in dark and light mode; players without a photo look as before; bench photos unchanged.
- [x] Settings shows "Prioritise names" / "Namen bevorzugen"; the switch works as before.
- [x] Lint, typecheck and tests pass; src/domain at 100 %; every other screen unchanged in the screenshot compare.

## 38. v9.0 — Guided tour

Owner request: a tutorial with popups and a small visual guide. On first start ask: **Full tour** (every screen,
briefly: starters, presets, formations, libero, live scoring, subs, performance, stats, seasons, print, export, appearance,
…), **Quick tour** (create a profile, a team, players, a season and a match, then set the lineup; every other screen asks
once "Quick tip for <page>?") or **No tour** (no tips anywhere). Profile → Tutorial → Choose again restarts, switches or
ends the tour. Data: store v11 adds the device settings `tourMode` and `tourSeen` (not exported). Details: DECISIONS
#241–246.

## 39. v9.0 acceptance checklist

- [x] First start (and the first start after the update) asks Full / Quick / No tour; the choice can't be skipped by accident.
- [x] Quick tour walks profile → team → players → season → match → lineup with a popup on each step, in order.
- [x] Quick tour: every other screen offers its tips once (Show me / No thanks).
- [x] Full tour: every screen shows short tips on the first visit, covering starters, presets, formations, libero, live, subs, performance, stats, seasons, print, export, appearance.
- [x] No tour: no tips anywhere.
- [x] Popups have a small visual guide, step dots, Back / Next and End tour; they fit at 375 px in German with the dyslexia font, dark + light.
- [x] Only the shown screen / tab triggers tips (pagers keep neighbours mounted).
- [x] Profile → Tutorial → Choose again: restart, switch or end; Cancel keeps.
- [x] Store v10 → v11 migration; export unchanged (golden test); Delete all data keeps the tour setting.
- [x] Lint, typecheck and tests pass; src/domain at 100 %; every other screen unchanged in the screenshot compare (only Profile has the new section).

## 40. v9.1 — Team captain

Owner request: mark the team captain with a small "C" in a small yellow circle at the top right of the player. One
captain per team (`Team.captainId`), set in the player form; shown on every player chip (court, bench, libero, rotation,
live, starters, presets) and on the roster cards; "Captain" on the player page; "(C)" on the print sheet. Store v12,
export `schemaVersion` 10. Details: DECISIONS #248–250.

## 41. v9.1 acceptance checklist

- [x] The player form has a "Team captain" switch; turning it on moves the captain, off clears it; Cancel changes nothing.
- [x] The captain's chips everywhere and roster card show a yellow circle with a dark "C" at the top right, readable in dark + light and with the dyslexia font, not covering the number, position badge or "*".
- [x] Player page shows "Captain"; screen readers hear "captain"; print sheet marks "(C)".
- [x] Export v10 keeps the captain; v1–v9 files and old data open; merge keeps the device's captain when the file has none; an invalid captain is dropped.
- [x] Lint, typecheck and tests pass; src/domain at 100 %; only captain-related screenshots changed.

## 42. v9.2 — Player list for the scorer

Owner request: a PDF of all players and their numbers to hand to the scorer ("Schreiber"). One A4 page: team (and
match: opponent, date, season, home / away), table No. · Last name · First name · C / L, sorted by number, active players
only. From the match's Print / PDF and the team's Roster tab. No data change. Details: DECISIONS #251–252.

## 43. v9.2 acceptance checklist

- [x] Match → Print / PDF → "Player list for the scorer" and Roster → "Player list (PDF)" print the list (PDF on phones, print dialog on web).
- [x] Sorted by number, active players only (injured left out, with a note), C for the captain, L for liberos; EN + DE.
- [x] From a match the sheet shows opponent, date (dd.mm.yy), season and home / away; one A4 page for up to 20 players.
- [x] The lineup sheet prints exactly as before; no data change (store 12, export 10, golden unchanged).
- [x] Lint, typecheck and tests pass; src/domain at 100 %; only the Roster tab changed in the screenshot compare.

## 44. v10.0 — Accounts and cloud sync (Supabase)

Owner request: team managers and players create an account, log in, and see the same team data on every device.
Managers edit; players view. The app keeps working fully offline and without an account, exactly like 9.2. This is the
app's first backend (until now local-only on purpose, DECISIONS #55). The full design (SQL schema, RLS, sync
algorithm, modules, UI, work breakdown) is in [`V10_SYNC_DESIGN.md`](V10_SYNC_DESIGN.md); the backend guide for
developers and the owner is `docs/SUPABASE.md`.

Owner's choices (asked at the start): sign in with a **6-digit code by email**; roles **manager + player** only;
confidential descriptions **stay on the device**; team and player photos sync to a **private bucket readable only by
the team's members**.

1. **Backend**: the hosted Supabase project "Volleylineup manager" (`qzeergfqfwovcvdarwua`, Zurich eu-central-2,
   free tier). Schema as SQL migrations in `supabase/migrations/`; RLS on every table (members read, managers write
   through RPCs); RLS test script `supabase/tests/rls.sql`; a keepalive workflow every 3 days.
2. **Offline-first sync**: the local store stays what the UI reads. Records (team, player, season, opponent, match,
   lineup set, preset, starters) sync in the background; the most recent save wins per record; deletions are
   tombstones. Sync status (synced / syncing / offline / error) with "Sync now". All backend code is in
   `src/lib/sync/` (ESLint-enforced); the merge rules are pure code in `src/domain/sync*.ts`.
3. **Accounts**: optional. Profile → Account: sign in with an email code, linked to the current local profile; on
   first sign-in the user picks which local teams to upload (none by default) and which cloud teams to download.
   Account screen: email, status, Sync now, sign out, delete account (server data only; local data stays).
4. **Teams, roles, invites**: a shared team has managers and players. Managers create invite codes (and a
   `volleylineup://join?code=` / web `/join?code=` link) for a role, revoke them (they expire), change roles and
   remove members; the last manager can't leave or demote themselves. Players see everything read-only, with a short
   reason on every edit control.
5. **Live match hold**: the device scoring a shared match live holds it (15-minute lease, refreshed); other devices
   see the match read-only ("Being scored live on Anna's device"), managers can take over. Viewers follow the score
   (15 s poll). Advisory: scoring offline always works; if two devices score the same set, the later save wins.
6. **Data model**: store **v13** adds the device-only `sync` state (account link, shared teams' bookkeeping). The
   export file is unchanged (`schemaVersion` **10**, golden byte-identical): sync bookkeeping is device-only.

## 45. v10.0 acceptance checklist

- [x] Without signing in the app behaves like 9.2: no network calls; screens unchanged except Profile → Cloud sync, the team header's Members / Share button and the Teams tab's sync / join entries.
- [x] Sign in with a 6-digit email code (EN + DE); wrong / expired code and offline messages; resend after 60 s.
- [x] First sign-in offers Upload (nothing pre-selected) and Download; nothing uploads without a tap.
- [x] Edits on device A appear on device B after Sync now / focus / ≤ 60 s; the same record edited on both → the later save wins per record (player, match, set, preset, starters, season, opponent, team fields).
- [x] Deletions sync (tombstones); a deleted season with a newer match added elsewhere comes back instead of losing the match.
- [x] Descriptions never leave the device and survive pulls; team and player photos sync (private bucket); profile photos stay local.
- [x] Offline or paused project: the app works, the badge says Offline with the pending count, no error screen, nothing lost; it syncs when back.
- [x] Roles: a player sees everything read-only, with a reason on every edit control (builder drag + tap, live, presets, starters, roster, seasons, opponents, matches, team rename / photo, import of that team).
- [x] Managers create, share and revoke invite codes (they expire); joining by code and by link works; roles change; members can be removed; the last manager can't leave or demote themselves.
- [x] A removed member's team stops syncing and stays as a local copy with a notice.
- [x] Live: the scoring device holds the match; other managers see "Being scored live on …" + Take over; viewers see the score update within ~15 s.
- [x] Delete team: "this device" vs "for everyone"; Leave team. Delete all data and deleting the linked profile sign out and keep the cloud teams. Delete account removes the server data (blocked while the user is the last manager of a team with other members) and keeps local data.
- [x] Import Replace / Merge never removes a shared team; viewer teams are skipped.
- [x] Store v12 → v13 migration (and v1 → v13); export schema 10 unchanged; golden byte-identical; old files import.
- [x] RLS script passes on the real project (stranger can't read, player can't write, manager of A can't touch B, removed member loses access); Supabase security / performance advisors clean or each warning explained; keepalive workflow green on dispatch.
- [x] `@supabase/*` imported only in `src/lib/sync` (lint); lint, format, typecheck and tests pass; `src/domain` at 100 %; a component test per feature; new screens have tour pages; 375 / 1280 px, EN + DE, dark + light, dyslexia font.

_Checked 2026-11-26 by the QA agent on the web build against the live project (two to four browser sessions as devices, password test users removed afterwards), then re-checked after the QA fixes (PR #93). Not checked on a real phone: see HANDOFF._

## 46. v11.0 — "Less app, more gym" (the look)

A design release: how the app looks changes, what it does doesn't. No feature, text, stored-data or sync change (store 13, export 10). The full brief with every value is `docs/V11_DESIGN.md`; the mock-ups (four screens before / after) are at https://claude.ai/artifact/VHo28JVUot3hFoocC1HwKo. The palette of §8 stays; `src/theme/colors.ts` gains soft shades of its own colours.

Five rules:

1. **The title is part of the page.** No grey header bar: a screen opens with its title on the page background; Back is a round button.
2. **Every colour has one job.** Solid orange: the court and the one main action of a screen. Soft orange: what is selected. Yellow: what is current (this set, the server) and notices. Blue: the opponent, the front row, links.
3. **Numbers are the picture.** Titles, scores and the jersey numbers on roster cards use Barlow Condensed (bundled, SIL OFL); everything else stays in the platform font. The dyslexia font replaces it too.
4. **Tone, not outlines.** A panel is `surface` on `background` without a border. Borders stay on focused text fields, the `danger` button and the court.
5. **Shapes mean something.** Buttons are pills, teams are rounded squares, players are circles.

Built in seven pull requests: (1) plan and theme values, (2) the header, (3) shared parts (buttons, rows, panels, tracks, fields, dialogs, banner, empty state, pill tab bar), (4) Teams, profile picker and the team tabs, (5) the match screens (lineup builder with Live and Print / PDF in the header and four link tiles, players on the court with a shadow, rotation, live, performance, stats), (6) player, forms, Settings, Profile, account, (7) motion, full check, docs, version 11.0.0 and a test build for the owner. No release before the owner tried the test build on a phone.

## 47. v11.0 acceptance checklist

- [x] No screen has the grey header bar; every screen shows its title once; Back is a round button and works after a reload. — _performance and match stats show only the back button; their page heading is the title (#346)._
- [x] Solid orange appears only on the court, the "Point us" button and one main action per screen (profile and team avatars keep their own colours).
- [x] Titles, scores and roster numbers use Barlow Condensed; scores and stat numbers have equal-width digits; with the dyslexia font on, no text uses Barlow and no label is in capitals.
- [x] Panels, rows and cards have no outline in either theme; all new colour pairs pass AA (test). — _left by design: the court, focused fields, `danger` buttons, checkboxes, the colour picker's selection, the delete-all confirmation, the set-won and match-summary panels, the tour's drawings._
- [x] The app tabs and the team tabs use the same pill bar; swipe and tap between tabs work as before. — _tests and a browser run; on a phone not yet._
- [x] Edit, Delete, Rename and Copy are icon buttons with their old accessible names; Delete still asks.
- [x] Lineup builder: Live is in the header; five link tiles; the notice is a banner without icon; players on the court have a shadow (the ring was taken out again, #355); "Who serves first" is visible at 390 × 844. — _four link tiles; Print / PDF is an icon in the header beside Live, because five tiles don't fit across in German (#345). "Who serves first" ends at 745 px in EN (was 830), 761 px in DE (was 849); with the dyslexia font 819 / 850 px (was 893 / 927)._
- [x] Live: the Substitution button is not lower than in 10.0.1 at 390 × 844 (EN, DE, font off and on). — _782 px (was 789); with the dyslexia font 773 px (was 786)._
- [x] Empty lists show the court drawing and the existing sentence.
- [x] Every interactive element is at least 44 × 44; labels start with the visible text (guard test). — _a script over all 33 screens (375 px, EN + DE) finds nothing under 44 px that 10.0.1 didn't have (only the switch graphic inside its 44 px row)._
- [x] EN and DE at 375 px, both themes, with and without the dyslexia font: nothing overflows or is cut without "…". — _looked at per pull request on contact sheets; known: in German with the dyslexia font the builder's serve choice ends 6 px below 844, and "11 von 11" takes two lines on the player screen._
- [x] No feature, text, stored-data or sync change: store 13, export 10, golden byte-equal, no diff under `src/lib/sync`, `src/domain`, `supabase/`. — _two unused strings removed, none added._
- [x] Lint, typecheck and tests pass in CI; the web export builds. — _201 suites / 2727 tests._
- [ ] The owner tried the test build on the phone. Only then: release. — _open: the test build is ready, the release waits for the owner._

_Checked 2026-11-27 on the web build (Playwright: all 528 screenshots per pull request, measurements at 390 × 844, a touch-target scan, a drag-and-drop and tab-bar run) and in Jest. Not checked on a phone._

## 48. v12.0 — Host a tournament

A coach who runs a tournament enters the teams, then the result of each match; the app keeps the plan and the table. It is a neutral scoreboard for all teams: names and results, no rosters, lineups or live scoring. The full brief (decisions, data model, every screen, the pull requests) is `docs/V12_TOURNAMENT_DESIGN.md`; the mock-ups are at https://claude.ai/artifact/Lxy4VJuy28wfEumLHncdix. A team's own seasons of the kind "Tournament" (§28) and the best-of-5 of its own matches are unchanged.

- **Where**: a fourth app tab, Tournaments, between Teams and Profile. A hosted tournament belongs to the profile.
- **Format**: one group, everyone plays everyone once. The plan (rounds by the circle method; with an odd number one team rests per round) is derived from the teams in the order they were added and never stored. 2 to 16 teams.
- **Sets per match**: 1 to 5 (default 3), per tournament. A match ends **best of N** (1, 3, 5: over when a team has won more than half) or when **all N sets are played** (the only choice for 2 and 4; a draw is possible).
- **Table**: best-of counts matches (2 per win), all-sets counts sets (1 per set won). Only finished matches count. Order: table points, set difference, ball difference, balls scored; teams equal in all four share a rank and are listed by name.
- **Results** are typed in per set: two whole numbers 0–99 that differ; no rule on how long a set is. A result may be saved unfinished. Only results are stored.
- **Settings can change later** while every stored result stays valid; otherwise the change is refused and names the match. **Removing a team** deletes its results (the confirmation says how many).
- **Data model** (`src/domain/types.ts`): `HostedTournament` (profile, name, optional date and place, `setsPerMatch`, `matchEnd`), `HostedTeam` (name, `order`), `HostedResult` (a pair of teams, `sets: { a, b }[]`). Store **v14** adds `hostedTournaments`, `hostedTeams`, `hostedResults`; export **schemaVersion 11** has the same three lists (files v1–v10 upgrade to empty lists). They are not part of cloud sync: nothing under `src/lib/sync`, `src/domain/sync*` or `supabase/` changes.
- **Logic** (`src/domain/hostedTournament.ts`, a barrel over `hostedPlan`, `hostedResult`, `hostedStandings`, `hostedForms`, `hostedData`): `roundRobin`, `matchOutcome`, `resultValidity`, `nextSetAllowed`, `tournamentPlan`, `standings`, `teamMatches`, `settingsChangeBlock`, form validation, `isHostedConsistent`, `importHosted`.
- **Screens**: the Tournaments tab (list, New tournament) · `/tournament-new?tournamentId=` (form, modal) · `/tournament/[tournamentId]?tab=table|matches|teams` · `/tournament/[tournamentId]/team/[teamId]` (a team's matches) · `/tournament/[tournamentId]/match?a=&b=` (result). The V11 look; no sideways scrolling.
- **Export / import**: "Export everything" includes the tournaments; a single team's file has none. Replace takes the file's tournaments; Merge matches by id (the file wins; the file's result for a pair of teams replaces the device's) and is refused when the combination doesn't fit together.

Built in five pull requests: (1) foundation — types, logic, store v14, export v11, strings, route helpers, this plan; (2) the Tournaments tab, its list and the form; (3) the tournament screen with Teams and Matches, the result screen; (4) the table and a team's matches; (5) tour pages, the full check, docs and version 12.0.0.

Later, not now: knock-out rounds and finals; groups; playing each other twice; courts and start times; printing the plan and the table; a live point counter; linking a hosted team to one of your own teams; sharing a hosted tournament through the cloud; the 1–5 sets option for a team's own matches.

## 49. v12.0 acceptance checklist

- [x] A fourth tab "Tournaments" lists the profile's hosted tournaments; create, edit, delete (with confirmation). The four tabs swipe and tap as the three did, and their labels fit at 375 px in German with the dyslexia font.
- [x] Sets per match can be 1 to 5; "best of" is offered only for 1, 3 and 5; the form says what the table counts.
- [x] Teams can be added (2 to 16), renamed and removed; names are unique; removing a team with results asks and says how many results go.
- [x] The Matches tab shows every pair once, grouped in rounds, with a resting team when the number is odd.
- [x] A result can be entered, changed and deleted set by set; invalid sets are refused with a text; in best-of no set can be added after the deciding one.
- [x] The table follows the ranking order above and counts matches or sets by the format (unit tests for wins, draws, shared ranks, odd team numbers).
- [x] A team's screen shows all its matches with results.
- [x] A settings change that would make a result invalid is refused and names the match.
- [x] Old data (store 13) and export files v1–v10 open without loss; an export / import round trip restores tournaments exactly; deleting a profile removes its tournaments.
- [x] Nothing under `src/lib/sync`, `src/domain/sync*`, `supabase/` changed; a team's seasons, matches and live scoring behave as in 11.0.0.
- [x] No sideways scrolling on the new screens; every control is at least 44 × 44; EN and DE at 375 px, both themes, with and without the dyslexia font: nothing overlaps or is cut without "…".
- [x] Tour pages exist for the new screens.
- [x] Lint, typecheck and tests pass in CI; `src/domain` at 100 %; the web export builds.
- [x] Released as 12.0.0 (owner, 2026-11-28: release when it is done; fixes follow as 12.0.x): https://github.com/Nick-ze/volley-lineup/releases/tag/v12.0.0

Checked in a browser and in Jest (DECISIONS #384); nothing was tried on a phone before the release (#385).

## 50. v12.1 — Own matches in a hosted tournament

The owner's request after 12.0.0: "add that you can write the matches in yourself". Asked how, the owner chose: per tournament.

- **Who makes the plan** is a choice in the tournament form ("The matches"): **"Everyone plays everyone once"** (the app works out the plan, as in 12.0; the default) or **"I enter the matches myself"**.
- **Own matches**: on the Matches tab the coach chooses two teams (chips that wrap; the team tapped first is the upper one) and taps "Add match". The matches are one list in the order added, labelled "Match 1", "Match 2", …; there are no rounds and no resting team. Two teams can meet more than once. At most 200 matches.
- **Results** are entered as before, per match. A match can be saved without a result again (clear every set); "Delete match" on the result screen removes the match after a question.
- **Table and a team's screen** count and list every match, also several of one pair.
- **Removing a team** deletes its matches; the question says how many.
- **The choice is fixed once the tournament has a result or a match**: a round robin has one result per pair and never an empty one, own matches may repeat a pair and may have no result, so neither turns into the other without loss. The form says so.
- **Data model**: `HostedTournament.plan: 'roundRobin' | 'manual'`. An added match is a `HostedResult` (in the order of the list; `sets` empty until its result is typed in; team A is the team chosen first; several per pair). Store **v15** (every tournament from before gets `plan: 'roundRobin'`); export **schemaVersion 12** (files v1–v11 upgrade the same way). Not in cloud sync; nothing under `src/lib/sync`, `src/domain/sync*` or `supabase/` changes.
- **Routes**: a round robin's result stays `/tournament/[tournamentId]/match?a=&b=`; an added match's is `/tournament/[tournamentId]/match?m=<match id>`.

## 51. v12.1 acceptance checklist

- [x] The form offers both ways, the app-made plan first, and says what each means; a new tournament can be created with own matches.
- [x] With own matches the Matches tab shows no plan of its own: two teams are chosen and "Add match" adds their match; the same two teams can be added again; a 201st match is refused with a text.
- [x] A result is entered, changed and cleared per match; "Delete match" asks and removes only that match.
- [x] The table counts every played match; a team's screen lists its matches under their numbers.
- [x] Removing a team says how many matches go and deletes them.
- [x] The choice can be changed while nothing is stored and is fixed afterwards, with a text.
- [x] Data stored by 12.0.0 (store 14) and export files v1–v11 open without loss, their tournaments with the app-made plan; a round trip keeps the plan kind, the order of the matches and a match without a result.
- [x] A round robin behaves as in 12.0.0 (its tests are unchanged apart from the versions and the new field).
- [x] No sideways scrolling; every control at least 44 × 44; EN and DE at 375 px, both themes, with and without the dyslexia font (`scripts/layout-scan.js`, screenshots).
- [x] Lint, typecheck and tests pass; `src/domain` at 100 %; the web export builds; nothing under the sync folders changed.
- [x] Released as 12.1.0: https://github.com/Nick-ze/volley-lineup/releases/tag/v12.1.0

## 52. v12.2 — Players and live scoring in a hosted tournament

The owner's request after 12.1.0: players for a tournament's teams, shown by number or by name, and a live mode like the one for a team's own matches — only the scoring, no rotations — that asks its questions with or without players ("team 1 blocked 4 times", or "player 6" / "Kelly scored an ace"). Two questions put to the owner were not answered; the simple choices were built (DECISIONS #393).

- **Players are optional.** On a tournament team's screen: "Players are shown by" **Number** or **Name** (per team), a number field and a name field with "Add". A player has a number (0–999), a name, or both; a number is unique in its team; at most 30 players per team. Edit is inline, Delete asks.
- **Live scoring** of any match of a hosted tournament, opened with "Live" at the top right of its result screen (`/tournament/[tournamentId]/live?a=&b=` or `?m=`): the set's score in large numbers, the sets won, one large "Point" button per team, "Undo" and "End set".
- **A set ends when the scorer taps "End set"** (a hosted tournament has no rule on a set's length); it is allowed when the two scores differ. The next point starts the next set. The match is over as its format says (best of N, or all sets played); then the screen says who won and offers "Done". "Undo" takes back the last step, also the end of a set or of the match.
- **Point details, all optional**: after a point the app asks how it was won — Attack, Ace, Block, Opponent's error. If the team in question has players it then asks who (for an error: who of the other team); a team without players is not asked. "Point details" under the board counts them per team ("4 blocks") and per player ("Kelly: 1 ace", or "#6: 1 ace" for a team shown by number).
- **No rotations, lineups, serve, time-outs or substitutions** in this live mode.
- **Elsewhere**: the Matches tab shows a running set's score in yellow; the result screen shows the point details and, for a match scored live, the sets as counted — to change them by hand, "Delete live details" (asks; the set scores stay). A team's screen adds up its point details over all its matches. Results, plan and table read the set scores as before; a running set doesn't count.
- **Data model**: `HostedPlayer { id, teamId, number?, name? }` in `hostedPlayers`; `HostedTeam.playerLabel?: 'number' | 'name'`; `HostedResult.live?: HostedPoint[][]` (one list of rallies per set; one more than `sets` while a set is being played); `HostedPoint { team, kind?, playerId? }`. Store **v16**, export **schemaVersion 13** (older data and files get an empty player list). Not in cloud sync; nothing under `src/lib/sync`, `src/domain/sync*` or `supabase/` changes.

## 53. v12.2 acceptance checklist

- [x] A team's players can be added, edited and deleted; a number can't be used twice in a team; a player needs a number or a name; a 31st player is refused with a text.
- [x] "Players are shown by" Number / Name changes how the team's players are named in the list, in the live questions and in the point details.
- [x] "Live" on a result screen opens the match's live scoring, for a round robin's pair and for an added match; a tap on "Point" counts for that team; "Undo" takes back points, the end of a set and the end of the match.
- [x] "End set" is offered only when the scores differ; the finished set shows in the Matches tab, the table and the team's screen; a running set shows in the Matches tab and counts nowhere.
- [x] After a point the kind can be chosen, changed and taken back; a team with players is asked who, a team without isn't; "Opponent's error" asks for a player of the other team.
- [x] "Point details" counts per team and per player on the live screen and the result screen; a team's screen adds up its matches.
- [x] A match scored live shows its sets locked on the result screen; "Delete live details" asks, keeps the set scores and frees the form. Saving sets by hand drops nothing silently.
- [x] Deleting a player keeps how the points were won and removes only the name; players go with their team, tournament and profile.
- [x] Data stored by 12.1.0 (store 15) and export files v1–v12 open without loss; a round trip keeps players, how a team is shown, the rallies and a running set.
- [x] A team's own matches and their live mode are unchanged (their tests are untouched).
- [x] No sideways scrolling; every control at least 44 × 44; EN and DE at 375 px, both themes, with and without the dyslexia font (`scripts/layout-scan.js`, screenshots).
- [x] Lint, typecheck and tests pass; `src/domain` at 100 %; the web export builds; nothing under the sync folders changed.
- [x] Released as 12.2.0: https://github.com/Nick-ze/volley-lineup/releases/tag/v12.2.0

## 54. v12.3 — The table of a hosted tournament as a PDF

The owner's request after 12.2.0: "print a PDF … which shows easily which team has how many points", for telling the points at the end.

- **"Table (PDF)"** is a button on the Table tab, under the table (shown once the tournament has two teams). On the web it opens the browser's print dialog ("Save as PDF"); on a phone it makes an A4 PDF and opens the share sheet — the same two ways as the lineup sheet and the player list.
- **The page** (A4 portrait, black on white): "Final table" once every match is played, "Table" before; the tournament's name; date, place, format and "9 of 15 matches played". Then the table in large type — rank, team, played, record (W–L, or W–D–L where a match can end in a draw), sets, ball difference and the **points** as the largest number of the row — and the ranking rule in one line.
- **Under it, "Results"**: every match with its number, the two teams (the winner in bold), the sets won and each set's score; "not played yet" and "(not finished)" where that is so. A round robin shows its rounds with the resting team; own matches are one numbered list. A set being scored live is not on the page.
- In the app's language. No stored-data change (store 16, export 13).

## 55. v12.3 acceptance checklist

- [x] The Table tab has "Table (PDF)" once the table is shown; it is at least 44 px high and its accessible name starts with its text.
- [x] The page lists the teams in the table's order with the same numbers as the Table tab, the points largest.
- [x] It says "Final table" only when every match is played, and how many matches are played.
- [x] Every match is listed with its result; the winner is bold; unplayed and unfinished matches say so; rounds and the resting team for a round robin, match numbers for own matches.
- [x] Team, tournament and place names are escaped; the page is in English or German with the app.
- [x] A failed print says so and can be tried again.
- [x] Sixteen teams with long names fit the table on the first page; a round is not split over two pages (looked at as PDFs from the web build).
- [x] Lint, typecheck and tests pass; `src/domain` at 100 %; the web export builds; nothing under the sync folders changed.
- [x] Released as 12.3.0: https://github.com/Nick-ze/volley-lineup/releases/tag/v12.3.0
