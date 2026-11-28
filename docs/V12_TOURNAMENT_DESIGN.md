# V12 — Host a tournament (design and build brief)

Decided on 2026-11-28 by the lead designer of V11, at the owner's request: "an option to host a tournament where you can enter all the teams and then track how good they play against each other. Tournaments don't always have to be 5 sets, so make it an option to set it to any number 1–5."

Mock-ups of the three main screens: https://claude.ai/artifact/Lxy4VJuy28wfEumLHncdix (read it once with the Artifact tool, `action: "read"`; the drawings use the values below). Where this brief is silent, choose the simplest option that fits, record it in `docs/DECISIONS.md` and go on.

## What it is

A coach who runs a tournament enters the teams, then the result of each match, and the app keeps the plan and the table. It is a neutral scoreboard for all teams: no rosters, no lineups, no live scoring.

It is separate from everything that exists:

- A team's **season of the kind "Tournament"** (v7: your own team's matches, with lineups and live scoring) stays exactly as it is.
- The fixed best-of-5 of your own team's matches (`SETS_TO_WIN`) is **not** changed. The 1–5 option belongs to hosted tournaments only. (If the owner wants it for the team's own matches too, that is a separate version: it touches live scoring and synced data.)

## Decisions

1. **Where**: a fourth app tab, **Tournaments**, between Teams and Profile (Ionicons `trophy` / `trophy-outline`). A hosted tournament belongs to the profile, not to a team.
2. **Format**: one group, everyone plays everyone once. No knock-out, groups, second round, courts or times in this version.
3. **The plan is derived, not stored.** The rounds come from the teams in the order they were added (circle method; with an odd number one team rests per round). Adding or removing a team recalculates the plan; results stay with their pair of teams.
4. **Sets per match: 1 to 5** (default 3), chosen per tournament.
5. **How a match ends**, chosen per tournament:
   - **Best of N** (only for 1, 3, 5; default): the match ends when a team has won more than half of N.
   - **All N sets are played** (the only choice for 2 and 4): a match can end in a draw.
6. **Table points follow from decision 5**, with no extra setting: best-of counts **matches** (2 for a win, 0 for a loss); all-sets counts **sets** (1 per set won). The table says which one it counts.
7. **Ranking**: table points, then set difference, then ball-point difference, then ball points scored. Teams equal in all four share a rank and are listed by name. No head-to-head rule.
8. **Results are typed in per set**: two whole numbers from 0 to 99 that differ. There is no rule on how long a set is (tournaments play to 15, 21, 25 or on time).
9. **Only results are stored**; plan, match outcome and table are derived (as with the rest of the app: nothing about results is stored twice).
10. **Limits**: 2 to 16 teams (16 teams are 120 matches); names are unique within the tournament, ignoring case, at most `MAX_NAME_LENGTH`.
11. **Changing the settings later**: allowed as long as every stored result is still valid. A change that would make a result invalid (fewer sets than a result has; best-of when a result has a set after the deciding one) is refused with a message that names the match.
12. **Removing a team** deletes its results; the confirmation says how many.
13. **Not in the cloud.** Hosted tournaments live on the device and in the backup file. Nothing under `src/lib/sync`, `src/domain/sync*` or `supabase/` changes.
14. **Version 12.0.0**: store 14, export `schemaVersion` 11.

## Data model

In `src/domain/types.ts` (the single source of types):

```ts
type SetsPerMatch = 1 | 2 | 3 | 4 | 5;
type MatchEnd = 'bestOf' | 'allSets';

interface HostedTournament {
  id: string;
  profileId: string;
  name: string; // unique within the profile, ignoring case
  date?: string; // ISO YYYY-MM-DD
  location?: string;
  setsPerMatch: SetsPerMatch; // default 3
  matchEnd: MatchEnd; // 'allSets' when setsPerMatch is 2 or 4
  createdAt: string;
}

interface HostedTeam {
  id: string;
  tournamentId: string;
  name: string;
  order: number; // the order added; the plan is built from it
}

/** A result. At most one per pair of teams; `teamAId` is the pair's team with the lower `order`. */
interface HostedResult {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  sets: { a: number; b: number }[]; // 1 … setsPerMatch, in the order played
}
```

- Store: `hostedTournaments`, `hostedTeams`, `hostedResults`; `STORE_VERSION` 14 with a migration that adds the three empty arrays. Deleting a profile deletes its tournaments, their teams and results; "Delete all data" too.
- Export: `schemaVersion` 11 with the three arrays; files of version 1–10 upgrade to empty arrays. Consistency checks: every team's tournament and every result's teams exist; one result per pair. Replace and Merge as for the other collections (Merge by id). Update the export golden with `UPDATE_GOLDEN=1` and add a v10 legacy file.

Pure logic in `src/domain/hostedTournament.ts` (split into sub-modules if it grows; 100 % coverage):

- `roundRobin(teamIds)`: rounds of pairs by the circle method, plus the resting team of a round.
- `resultValidity(sets, setsPerMatch, matchEnd)` and `matchOutcome(…)`: sets won by each side, ball points, state `open` / `running` / `done`, and winner, `draw` or none.
- `nextSetAllowed(…)`: whether another set may be entered.
- `standings(tournament, teams, results)`: per team played, won, drawn, lost, sets for and against, ball points for and against, table points, rank (shared when equal).
- `teamMatches(teamId, …)`: a team's matches in plan order with their results.
- `settingsChangeBlock(…)`: the first result a settings change would make invalid, or none.
- Form validation for the tournament and for team names.

## Screens

All in the V11 look (`docs/V11_DESIGN.md`, HANDOFF "Look (v11)"): titles on the page, flat panels, pills, `useTrackStyles`, `IconButton`, `EmptyState`, `Banner`, tabular digits, one solid-orange action per screen. No sideways scrolling anywhere (it failed on the owner's phone, DECISIONS #357).

**Tournaments tab** (`app/(tabs)/tournaments.tsx`): page title "Tournaments", the profile's name above it. "New tournament" (primary). Each tournament is a `ListRow`: name; under it "6 teams · 9 of 15 matches played" and the date; Edit and Delete as icon buttons. Empty state with one sentence. A short hint under the list says that a tournament your own team plays in, with lineups and live scoring, is created in the team's Matches tab.

**New / edit tournament** (`/tournament-new?tournamentId=`, modal, compact header): name, date (dd.mm.yy, optional), place (optional), "Sets per match" as a track 1–5, "A match ends" as a track "Best of N" / "All sets are played" (with 2 or 4 sets only the second is offered), and one line that says what the table counts. Save (primary), Cancel.

**Tournament** (`/tournament/[tournamentId]?tab=table|matches|teams`, large header with the name): a quiet line "05.12.26 · Halle Süd · best of 3", then the three tabs as chips with swipe (`SwipeTabs`), like the season screen. It opens on Teams while there are fewer than two teams, otherwise on Matches; `?tab=` wins.

- **Teams**: a name field with "Add" (primary); the teams as rows with Rename and Delete icons; "6 of 16 teams". A hint: "Adding or removing a team changes the plan; results stay."
- **Matches**: "9 of 15 played", then the rounds, each under a small label ("Round 1"). A match is one row built like a scoreboard line: the two names one above the other at the left; at the right one narrow column per set with the two scores one above the other, and a last column with the sets won. The winner's name and sets are in full text colour and bold, the loser's in grey; a draw shows both in full colour. An open match shows "–" and a chevron. A round's resting team is one grey line. Tapping a match opens its result.
- **Table**: one row per team, not a grid: the rank as a large number at the left, the name, under it one line "4 played · 3–1 · sets 7:3 · balls +24" (with draws: "3–1–0"), and at the right the table points as a large number over the label "Matches" or "Sets". Tapping a row opens that team's matches. Under the list one line explains the ranking order.

**A team's matches** (`/tournament/[tournamentId]/team/[teamId]`, large header with the team's name): its rank and numbers as one band of large numbers (like the season record), then its matches in plan order as the same scoreboard rows. This is the "how they played against each other" view.

**Result** (`/tournament/[tournamentId]/match?a=…&b=…`, compact header "Result"): at the top the two names with the sets won as large numbers (the display typeface, tabular). Below, one row per set: label "Set 1", a number field, ":", a number field (numeric keyboard, two digits, the text is selected on focus). The next set's row appears when the one before is valid and the match is not decided. Errors under the row ("The two scores must differ"). Save (primary) and, when a result exists, "Delete result" as red text. Clearing both fields of the last set removes that set.

## Texts

New i18n files `src/i18n/en/tournament.ts` and `src/i18n/de/tournament.ts` (German typed from English). German: Turniere, Neues Turnier, Sätze pro Spiel, Ein Spiel endet, "Best of N" stays, Alle Sätze werden gespielt, Tabelle, Spiele, Teams, Runde, spielfrei, Ergebnis, Bälle. Accessible names start with the visible text.

## Tour

Per HANDOFF ("New screens need a tour page"): pages for the Tournaments tab, the tournament screen (one per tab) and the result screen, each with one or two short tips; add them to the quick tour only if it stays short.

## How to build it

Five pull requests, in this order, each merged only on green CI, with screenshots before and after (`scripts/screenshots.js`; add the new screens to `SCREENS` and seed a tournament with six teams and some results in the script's storage).

1. **Foundation**: types, `src/domain/hostedTournament*` with tests, store v14 + migration, export v11 + upgrade + golden, store hooks, the i18n files with all strings, the routes registered in `app/_layout.tsx`, `parentRoute.ts` and `headerVariant.ts`, PLAN §48 (features) and §49 (acceptance list), DECISIONS. No visible change yet.
2. **Tournaments tab, list and form.**
3. **Tournament screen**: Teams and Matches tabs, the result screen.
4. **Table and a team's matches.**
5. **Tour pages, the full check, docs** (README "What's new", version history, HANDOFF), **version 12.0.0** and a test build (`android-apk.yml` with `release: false`). No release without the owner.

Checks for every pull request: `npm run check`, `npx expo export -p web --clear`, the screenshots looked at in EN and DE, dark and light, with the dyslexia font, at 375 px; the touching-panels scan and the 44 px scan from V11 (HANDOFF §6); one independent QA agent on the finished build before the last merge. Say in each pull request what could not be checked on a phone.

## Acceptance list (PLAN §49)

- [ ] A fourth tab "Tournaments" lists the profile's hosted tournaments; create, edit, delete (with confirmation).
- [ ] Sets per match can be 1 to 5; "best of" is offered only for 1, 3 and 5; the form says what the table counts.
- [ ] Teams can be added (2 to 16), renamed and removed; names are unique; removing a team with results asks and says how many results go.
- [ ] The Matches tab shows every pair once, grouped in rounds, with a resting team when the number is odd.
- [ ] A result can be entered, changed and deleted set by set; invalid sets are refused with a text; in best-of no set can be added after the deciding one.
- [ ] The table follows the ranking of decision 7 and counts matches or sets per decision 6 (unit tests for wins, draws, shared ranks, odd team numbers).
- [ ] A team's screen shows all its matches with results.
- [ ] A settings change that would make a result invalid is refused and names the match.
- [ ] Old data (store 13) and export files v1–v10 open without loss; an export / import round trip restores tournaments exactly; deleting a profile removes its tournaments.
- [ ] Nothing under `src/lib/sync`, `src/domain/sync*`, `supabase/` changed; a team's seasons, matches and live scoring behave as in 11.0.0.
- [ ] No sideways scrolling on the new screens; every control is at least 44 × 44; EN and DE at 375 px, both themes, with and without the dyslexia font: nothing overlaps or is cut without "…".
- [ ] Tour pages exist for the new screens.
- [ ] Lint, typecheck and tests pass in CI; `src/domain` at 100 %; the web export builds.
- [ ] The owner tried the test build on the phone. Only then: release.

## Later, not now

Knock-out rounds and finals; groups; playing each other twice; courts and start times; printing the plan and the table; a live point counter for the scorer's table; linking a hosted team to one of your own teams; sharing a hosted tournament through the cloud; the 1–5 sets option for your own team's matches.
