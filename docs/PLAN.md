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
  | 'kill' | 'ace' | 'block' | 'opponentError'   // winner: 'us'
  | 'ourError' | 'opponentKill' | 'opponentAce'; // winner: 'them'
type SetEvent =
  | {
      type: 'point';
      winner: Side;
      kind?: PointKind;  // must belong to the winner
      playerId?: string; // only with kill / ace / block / ourError; a player of the team
      at?: string;       // ISO time the rally was recorded (match duration)
    }
  | { type: 'sub'; outPlayerId: string; inPlayerId: string };
// ExportFile.schemaVersion: 4 (v1–v3 files upgraded on import; old events stay valid)
// Store: version 4 (v3 → v4 needs no data change; old events stay valid)
```

Set and match results are derived by pure functions (`src/domain/matchState.ts`): `setScore`, `setWinner`, `getMatchState(match) → { sets, setsWon, winner, status, currentSetNumber, durationMs }`. Nothing about the result is stored.

## 17. v3 acceptance checklist

- [ ] A full 5-set match can be played in live mode from set 1 to the match summary without leaving live mode, and the set / match results are correct (tests: 3:0, 3:2 with a 15-point tiebreak, deuce sets).
- [ ] Undo works across a set end (it re-opens the set).
- [ ] Rotation stats (points won / lost, side-out %, break points per rotation) are correct for a scripted match (tests with literal expected numbers).
- [ ] Player stats are correct for a scripted match with substitutions and libero swaps (tests).
- [ ] Point tagging is optional, and its per-player totals are correct.
- [ ] v3.0.0 opens v2.x data (store v3) and v1–v3 export files without loss; export / import round trip with tags restores exactly.
- [ ] Phone layout (390×844): live controls and the set / match score fit without scrolling; the stats tables are readable at 375 px. EN + DE.
- [ ] Lint, typecheck and tests pass in CI; `src/domain` 100%.
