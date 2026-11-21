# Volleyball rules reference (indoor, 6 v 6)

What the rules of indoor volleyball say about everything this app models (lineups, rotations, roles, libero, substitutions, scoring), plus the coaching conventions the app follows. Use it to check the app and as a reference for future work. §6 lists testable invariants and whether the code meets them today.

Last checked: 2026-11-21, against the code on `main` after the v5 lineup builder (#40) plus this branch (formation roles on every court incl. the lineup builder, formation controls with confirmation, point-tag player checks).

## Sources and how to read the citations

| Key      | Source                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FIVB** | FIVB _Official Volleyball Rules 2025–2028_ (English), approved by the 39th FIVB Congress: <https://www.fivb.com/wp-content/uploads/2025/01/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf> (mirror: <https://volleyball.dk/wp-content/uploads/2025/09/FIVB-Volleyball_Rules2025_2028-EN-v05.pdf>)                                                                                                                                                 |
| FIVB-Mod | FIVB, _Rules modifications 2025–2028_ (2021–2024 vs 2025–2028 text side by side): <https://www.vbahk.org.hk/items/media/Refereeing/202528_Volleyball_Rules/VB/fivbvolleyball_rulesmodification20252028.pdf>                                                                                                                                                                                                                                  |
| CEV      | CEV, _New Refereeing Guidelines and Instructions 2025_: <https://inside.cev.eu/media/bm4jik3r/new-guidelines-instructions-2025.pdf>                                                                                                                                                                                                                                                                                                          |
| DVV      | DVV uses the FIVB rules (German edition). 2025/26 changes as summarised by regional associations: <https://www.vmv24.de/schiedsrichter/news/wichtige-aenderungen-im-dvv-regelwerk-2025.html>, <https://www.volleyballer.de/regeln/aenderungen.php>; Swiss federation (same FIVB text, German): <https://www.volleyball.ch/_Resources/Persistent/8/a/c/9/8ac9dfd158947d9b4626b8b7c96d8c13fcfc19e3/%C3%84nderungen-Regeln-2025-d_20250128.pdf> |

"FIVB 7.4.3" means rule 7.4.3 of the FIVB 2025–2028 rules. Coaching sources are cited inline.

> **Caveat on rule numbers.** The research for this file was done with web search only: the FIVB PDFs could not be opened from the build sandbox (fivb.com isn't on its network allowlist). Rule contents are confirmed by several sources, but some sub-numbers (e.g. 15.6.x, 19.3.x) follow the long-standing FIVB structure, which the 2025–2028 edition kept for these chapters as far as the sources show. Check the PDF before quoting a sub-number somewhere binding.

---

## 1. Court positions, rotation and positional faults

### 1.1 Positions

| Position | Place               | Row   |
| -------- | ------------------- | ----- |
| 1        | back right (server) | back  |
| 2        | front right         | front |
| 3        | front centre        | front |
| 4        | front left          | front |
| 5        | back left           | back  |
| 6        | back centre         | back  |

- FIVB 7.4.1: the three players along the net are front-row players (positions 4, 3, 2); the other three are back-row players (positions 5, 6, 1).
- Positions are numbered counter-clockwise from the server's spot. Players move clockwise.
- **Opposite pairs** (directly across the rotation circle): 1–4, 2–5, 3–6. In every rotation exactly one player of each pair is in the front row.
- **Corresponding pairs for the overlap rule** (FIVB 7.4.2.1): front/back, i.e. 4–5, 3–6, 2–1. **Neighbours in a row** (FIVB 7.4.2.2): 4–3–2 in front and 5–6–1 at the back.

### 1.2 Rotational order and when a team rotates

- FIVB 7.3: before each set the coach hands in the starting line-up (6 players, positions 1–6). It can change from set to set. The libero isn't part of it (FIVB 19.3.2).
- FIVB 7.6.1: the rotational order is set by the starting line-up and kept for the whole set, through the service order and player positions.
- FIVB 7.6.2: **when the receiving team wins the right to serve (a side-out), its players rotate one position clockwise**: 2 → 1 (and serves), 1 → 6, 6 → 5, 5 → 4, 4 → 3, 3 → 2.
- FIVB 6.1.3 and 12.2.2: the team that wins a rally on its own serve scores and **serves again with the same server, without rotating**. The team that wins on the opponent's serve scores, gets the serve and rotates.
- FIVB 12.2.1: the server is always the player at position 1.
- FIVB 7.7: a **rotational fault** is a serve that breaks the rotational order (wrong server). The opponent gets a point and the serve. The order is corrected, and points scored during the fault are cancelled.

### 1.3 Positional faults (the overlap rule)

The rule judges where the players stand **at the moment of the service hit**, by where their feet touch the floor (FIVB 7.4.3):

- **Front/back** (FIVB 7.4.3.1): each back-row player must have at least part of one foot further from the centre line than the front foot of the corresponding front-row player: 5 behind 4, 6 behind 3, 1 behind 2.
- **Left/right** (FIVB 7.4.3.2): each right or left player must have at least part of one foot closer to their own sideline than the feet of the centre player of the same row: 4 left of 3, 3 left of 2, 5 left of 6, 6 left of 1.
- After the hit everyone may move anywhere (FIVB 7.4.4), with the back-row restrictions on attacking and blocking (FIVB 13.2.3, 14.6.2) still in force.
- **Fault**: FIVB 7.5. A player out of position at the service hit is a positional fault. The opponent gets a point and the serve, and positions are corrected.

**What's new in 2025–2028** (FIVB 7.4, FIVB-Mod, DVV summaries):

- Only the **receiving team** must be in rotational order at the service hit. The **serving team's players may stand anywhere on their court**. A wrong server is still a rotational fault (7.7), and every player must still be on their own court.
- The **server** has always been exempt from the overlap rule, because they serve from the service zone.
- The DVV applies this from the 2025/26 season. US codes (NCAA, NFHS, USAV) have **not** adopted it: there the serving team must still be in order.
- FIVB/CEV test for 2025 FIVB events (CEV guidelines): the receiving team's positional fault is judged at the **server's toss**, not at the hit. This is a competition test, not a general rule.
- New FIVB 12.5.3 (DVV summaries): serving-team players must not raise their hands above their heads before the ball crosses the net (a screen). A warning comes first.

**Why this matters for the app:** the app stores rotational positions (who stands at 1–6), not where players stand when receiving serve. The rotational order is legal by construction. Overlap and receive formations aren't modelled (see §6).

### 1.4 "Rotation 1 … 6" in coaching

The rules have no rotation numbers. Coaches use three conventions, and they clash:

| Convention                                                                                                                                                                                                                                          | Rotation 1   | Order the team plays them in |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------- |
| **A. By the setter's position** ("P1 … P6", common in Europe, Italian/Polish style). The rotation is named after the setter's court position.                                                                                                       | setter at 1  | 1 → 6 → 5 → 4 → 3 → 2        |
| **B. By service order from the setter** (common in US coaching material: "Rotation 1 = setter in 1, Rotation 2 = setter in 6", e.g. <https://defyinggravityvolleyball.squarespace.com/blog/the-5-1-volleyball-rotation-pdf-guide-to-rotations-1-6>) | setter at 1  | 1 → 2 → 3 → 4 → 5 → 6        |
| **C. From the start of the set** (rotation 1 = the starting six, +1 per side-out)                                                                                                                                                                   | starting six | 1 → 2 → … → 6                |

A and B agree only on rotation 1 ("S1"). A team that starts with the setter at 1 meets the setter positions in the order 1, 6, 5, 4, 3, 2. Gold Medal Squared and other US sources use B-style numbering (<https://goldmedalsquared.com/post/volleyball-rotations/>).

In a **6-2** the back-row setter usually names the rotation, so only 1, 6 and 5 occur, each twice. In a **4-2** the front-row setter sets, so coaches name rotations after the front-row setter (4, 3, 2) or simply count them.

The app uses **A** (DECISIONS #117, #125). Since v5 the formation fixes the setter spot, so every court, even an empty or incomplete one, is named after that spot (`roles.ts` `formationRotation`). The fallback **C** only remains for a live court without anyone on a setter spot, which a complete six can't have.

---

## 2. Team systems (formations)

The rules don't prescribe roles: any player may stand at any position as long as the rotational order is kept. The layouts below are coaching conventions. A layout that breaks them is **legal but tactically broken**, so the app should warn, not block.

Role codes: S = setter, OPP = opposite (right side), OH = outside hitter (left side), MB = middle blocker, L = libero, DS = defensive specialist. "Pos 1…6" = court positions in the starting rotation, shown with the setter serving (S at 1).

### 2.1 5-1 (one setter, the most common system above youth level)

- **Pairs**: S–OPP, OH–OH and MB–MB, each pair opposite (1–4, 2–5, 3–6) (<https://www.playingvolley.com/5-1-rotation-guide/>, <https://en.wikipedia.org/wiki/Volleyball_offensive_systems>).
- Around the circle the hitters therefore alternate: after the setter comes OH, MB, OPP, OH, MB, or MB, OH, OPP, MB, OH.
- There are two valid orderings. "Followed by" means service order: the player at 2 serves after the player at 1.

| Variant                              | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 | Pos 6 |
| ------------------------------------ | ----- | ----- | ----- | ----- | ----- | ----- |
| **A: setter followed by an outside** | S     | OH1   | MB1   | OPP   | OH2   | MB2   |
| **B: setter followed by a middle**   | S     | MB1   | OH1   | OPP   | MB2   | OH2   |

- **Variant A** is the order printed in most rotation guides and diagrams. The serving order is given as "S, OH1, MB1, OPP, OH2, MB2" (playingvolley.com; Wikipedia). It is also the app's 5-1 template (DECISIONS #63).
- **Variant B** is also common. Some coaches recommend a middle next to the setter as the default because it gives cleaner serve-receive patterns (<https://coachingvb.com/setting-starting-rotation-5-1/>, "middle in front of the setter").
- Terminology is inconsistent: "in front of", "leads" and "follows" are used both ways. Describe the variants by position numbers, not by those words.
- No reliable statistic says which variant is more common. Say "A is the textbook default" and nothing stronger.

**Variant A in all six rotations** (computed from the clockwise rule):

| Step | Setter rotation (A) | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 | Pos 6 | Front-row attackers | Libero in for (if it replaces the MBs)   |
| ---- | ------------------- | ----- | ----- | ----- | ----- | ----- | ----- | ------------------- | ---------------------------------------- |
| 1    | 1                   | S     | OH1   | MB1   | OPP   | OH2   | MB2   | 3 (OH1, MB1, OPP)   | MB2 at 6                                 |
| 2    | 6                   | OH1   | MB1   | OPP   | OH2   | MB2   | S     | 3                   | MB2 at 5                                 |
| 3    | 5                   | MB1   | OPP   | OH2   | MB2   | S     | OH1   | 3                   | MB1 at 1 only when receiving; MB1 serves |
| 4    | 4                   | OPP   | OH2   | MB2   | S     | OH1   | MB1   | 2 (setter in front) | MB1 at 6                                 |
| 5    | 3                   | OH2   | MB2   | S     | OH1   | MB1   | OPP   | 2                   | MB1 at 5                                 |
| 6    | 2                   | MB2   | S     | OH1   | MB1   | OPP   | OH2   | 2                   | MB2 at 1 only when receiving; MB2 serves |

**Variant B in all six rotations:**

| Step | Setter rotation (A) | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 | Pos 6 |
| ---- | ------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| 1    | 1                   | S     | MB1   | OH1   | OPP   | MB2   | OH2   |
| 2    | 6                   | MB1   | OH1   | OPP   | MB2   | OH2   | S     |
| 3    | 5                   | OH1   | OPP   | MB2   | OH2   | S     | MB1   |
| 4    | 4                   | OPP   | MB2   | OH2   | S     | MB1   | OH1   |
| 5    | 3                   | MB2   | OH2   | S     | MB1   | OH1   | OPP   |
| 6    | 2                   | OH2   | S     | MB1   | OH1   | OPP   | MB2   |

Properties of every valid 5-1:

- Exactly one of S/OPP, one OH and one MB is in the front row in every rotation.
- In rotations 1, 6 and 5 (setter in the back row) there are three front-row attackers. In 4, 3 and 2 there are two.

### 2.2 6-2 (two setters, the back-row setter sets)

| Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 | Pos 6 |
| ----- | ----- | ----- | ----- | ----- | ----- |
| S1    | OH1   | MB1   | S2    | OH2   | MB2   |

- The two setters are opposite (1–4). The OHs are opposite and the MBs are opposite. Variant B (S1 · MB1 · OH1 · S2 · MB2 · OH2) works the same way.
- The setter in the back row sets. The front-row "setter" attacks from the right side, so setters in a 6-2 are often setter/opposite hybrids. There are always three front-row attackers.
- Setter-named rotations (convention A) cycle 1, 6, 5, 1, 6, 5: after three rotations the other setter takes over at position 1.
- This is the app's 6-2 template (DECISIONS #63). It fills the hitter spots with OH, else OPP.

### 2.3 4-2 (two setters, the front-row setter sets; youth and recreational play)

- Same layout as the 6-2: setters opposite (1–4), the other two pairs opposite, e.g. S1 · OH1 · MB1 · S2 · OH2 · MB2.
- The difference is who sets: the front-row setter, usually from between positions 2 and 3. Only two front-row attackers (OH and MB), but no back-row setter has to run in (<https://en.wikipedia.org/wiki/Volleyball_offensive_systems>).
- Some 4-2 teams use "hitters" without the MB/OH split. Then the rule is simply S opposite S.

### 2.4 Other systems (short)

- **6-6 / 6-0**: every player sets when they rotate into a set position (usually 3 or 2). Beginners and youth (<https://usavolleyball.org/resource/why-should-i-run-a-6-3-or-6-6/>).
- **6-3**: three setters at every other position (1, 3, 5). Youth.
- **5-1 with a DS**: a defensive specialist subs for a front-row player when they reach the back row. These are ordinary substitutions, counted (unlike libero replacements).

### 2.5 Layouts that are legal but wrong (should produce a warning)

| System   | Wrong layout                                    | Effect                                                            |
| -------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| 5-1      | S not opposite OPP                              | some rotations have S and OPP both in front or both at back       |
| any      | the two MBs not opposite (e.g. adjacent at 2–3) | rotations with no middle or two middles in front                  |
| any      | the two OHs not opposite                        | rotations with no left-side hitter or two in front                |
| 6-2, 4-2 | the two setters not opposite                    | rotations with two or no setters in the back (6-2) or front (4-2) |
| 5-1      | two setters on court (e.g. a backup S as OH)    | not a 5-1. Fine as a role, but the template no longer applies     |

**In the app (v5):** the roles belong to the spots of a formation (5-1 or 6-2, both orders), so the first four layouts can't occur. A player whose listed positions don't match their spot's role is "off position" (confirmed and marked `*`), which covers the last row: a backup setter on an OH spot plays OH.

---

## 3. The libero

| Rule                    | What it says                                                                                                                                                                                                                             | Source                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Designation             | Each team may designate **up to two** liberos on the scoresheet. In FIVB, World and official senior competitions, a team with **more than 12** players listed must have two. A team may play without one.                                | FIVB 19.1.1             |
| One at a time           | Only one libero (the "acting libero") is on court at a time. The other is the second libero.                                                                                                                                             | FIVB 19.1.3             |
| Back row only           | The libero may replace **any back-row player**, at positions 1, 5 and 6.                                                                                                                                                                 | FIVB 19.3.1.1           |
| No attack above the net | The libero may not complete an attack hit from anywhere (court or free zone) when the ball is entirely above the top of the net at contact.                                                                                              | FIVB 19.3.1.2           |
| No serve, no block      | The libero may not serve, block or attempt to block.                                                                                                                                                                                     | FIVB 19.3.1.3           |
| Setting in front        | When the libero sets with an overhand finger pass from the front zone (or its extension), a teammate may not attack that ball above the net. From behind the attack line it's free.                                                      | FIVB 19.3.1.4           |
| Replacements            | Libero replacements are **not substitutions**. They're unlimited, but there must be a completed rally between two of them (exceptions for penalties and an injured libero). The libero can only be replaced by the player they replaced. | FIVB 19.3.2.1, 19.3.2.2 |
| Front row               | The libero may never rotate into the front row. They must leave before their position rotates to 4 (in practice the replaced player comes back when they reach position 4).                                                              | FIVB 19.3.1.1, 19.3.2   |
| Not in the line-up      | The libero isn't in the starting line-up. They enter after the second referee has checked it.                                                                                                                                            | FIVB 7.3, 19.3.2        |
| Libero only             | A designated libero may not play as a regular player in that match, except through the re-designation rules when the libero is injured or expelled.                                                                                      | FIVB 19.1, 19.4         |
| Injury / re-designation | If the libero can't play, the second libero takes over. Without one, the coach may re-designate a new libero from players not on court.                                                                                                  | FIVB 19.4               |

**Who the libero usually replaces:** the **two middle blockers**, whenever they are in the back row. The MB serves at position 1, then the libero comes in after the team loses that serve. Some teams use the libero for a weak-passing OH instead.

**National and league exceptions:**

- **NCAA** (US college) and **USA Volleyball** club rules let the libero **serve in one rotation per set** (<https://www.ncaa.com/news/volleyball-women/article/2023-07-03/college-volleyball-libero-explained>, <https://ncva.com/downloads/Libero%20serve%20rule%20USAV.pdf>). US high school (NFHS) has a similar rule. The NCAA also allows two liberos per set, one on court at a time (<https://www.ncaa.org/news/2024/2/20/media-center-double-contacts-approved-in-womens-volleyball.aspx>).
- **DVV / Germany** follows FIVB: **no libero serve** was found in any DVV or regional rule. Youth: regional youth rules don't allow a libero in the younger age groups. Several regions allow one from U16 up, others only at U18/U20 (e.g. NRW: <https://nwvv.de/wp-content/uploads/2025/11/Ordnungen_DuFue_NWDM-2025-2026.pdf>; Rhineland-Palatinate schools: <https://schulsport.rlp.de/fileadmin/schulsport/schulsportbroschuere/2024/ausschreibung_volleyball.pdf>).

---

## 4. Substitutions

| Rule                         | What it says                                                                                                                                                                                                                                                                                                     | Source              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Limit                        | **6 substitutions per team per set**. Several players may be substituted at the same time.                                                                                                                                                                                                                       | FIVB 15.6.1         |
| Starter                      | A starter may leave the game **once** per set and re-enter **once**, and only to their previous position in the line-up (i.e. for the player who replaced them).                                                                                                                                                 | FIVB 15.6.2         |
| Substitute                   | A substitute may enter **once** per set, only for a starter, and can only be replaced by **that same starter**.                                                                                                                                                                                                  | FIVB 15.6.3         |
| Exceptional substitution     | An injured or ill player who can't continue is first substituted legally. If that isn't possible, any player not on court at that moment (except the libero, the second libero and their replaced player) may replace them, **outside the limits of 15.6**. It still counts as a substitution on the scoresheet. | FIVB 15.7           |
| Expulsion / disqualification | The player must be substituted legally. If that isn't possible, the team is declared incomplete.                                                                                                                                                                                                                 | FIVB 15.8           |
| Illegal substitution         | Exceeding 15.6 (except 15.7), or using an unregistered player, is illegal. The opponent gets a point and the serve, and the substitution is corrected.                                                                                                                                                           | FIVB 15.9           |
| Libero                       | Libero replacements aren't substitutions, and the libero can't take part in a regular or exceptional substitution.                                                                                                                                                                                               | FIVB 15.5, 19.3.2.1 |

The substitute takes the replaced player's position in the rotation, so the rotational order doesn't change.

**National differences (brief):**

- DVV adult competitions use FIVB 15.
- Youth competitions in Germany play 6 v 6 only from about U16. Younger age groups play smaller formats (2 v 2 to 4 v 4) with their own rules. NRW's U14, for example, plays 4 v 4 with up to 6 substitutions per set (<https://www.volleyball.nrw/fileadmin/der_verband/ordnungen/2024-2025/Jugendspielordnung_Stand_JVT_2024.pdf>).
- US high school (NFHS) allows more substitutions per set (18) with its own re-entry rules (not verified in detail here). Don't hard-code 6 if those codes ever matter.

---

## 5. Scoring, serve and changing ends

| Rule          | What it says                                                                                                                                                                                              | Source              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Rally point   | Every rally scores a point for the team that wins it. The receiving team that wins a rally also gets the serve (and rotates).                                                                             | FIVB 6.1, 6.1.3     |
| Set           | Won by the first team to **25** with a lead of at least **2**. At 24–24, play continues until one team leads by 2 (no cap).                                                                               | FIVB 6.2            |
| Match         | **Best of five**: the first team to win 3 sets.                                                                                                                                                           | FIVB 6.3.1          |
| Deciding set  | Set 5 is played to **15** with a lead of at least 2.                                                                                                                                                      | FIVB 6.3.2          |
| First serve   | Before the match, a **coin toss** decides who serves first and which side each team starts on. A **new toss** decides set 5.                                                                              | FIVB 7.1, 12.2.2.1  |
| Sets 2–4      | Started by the team that **did not serve first** in the previous set.                                                                                                                                     | FIVB 12.2.2.2       |
| Changing ends | After each set, except before the deciding set (that end comes from the toss). In the **deciding set, teams change ends when the leading team reaches 8 points**, without delay; positions stay the same. | FIVB 18.2.1, 18.2.2 |
| Time-outs     | Up to 2 time-outs per team per set (30 s).                                                                                                                                                                | FIVB 15.2.3, 15.4   |

Other formats: many youth, school and tournament competitions play **best of three** (two sets to 25, the third to 15, ends changed at 8). Examples: German school and youth competitions (<https://schulsport.rlp.de/fileadmin/schulsport/schulsportbroschuere/2024/ausschreibung_volleyball.pdf>), NCAA/NFHS variants.

---

## 6. Checks for the app

Each invariant is testable. **PASS** = the code satisfies it. **FAIL** = the code contradicts it. **NOT MODELLED** = the app doesn't represent it (a deliberate scope limit unless marked otherwise). File references are to `src/domain/` unless a path is given. "By construction" means the data model can't express the broken case.

### Positions and rotation

1. **Front row = 2, 3, 4; back row = 1, 5, 6.** PASS. `rotation.ts` `FRONT_ROW_POSITIONS`, `BACK_ROW_POSITIONS`.
2. **One clockwise rotation moves 2→1, 3→2, 4→3, 5→4, 6→5, 1→6.** PASS. `rotation.ts` `nextPositionClockwise`, `rotateClockwise`.
3. **Six rotations return to the start.** PASS. `rotation.ts` `rotateBy` normalises modulo 6.
4. **Opposite pairs are 1–4, 2–5, 3–6.** PASS. `rotation.ts` `oppositePosition`.
5. **A team rotates only when it wins a rally on the opponent's serve, and doesn't rotate after winning on its own serve or after losing.** PASS. `liveSet.ts` `replay` (`event.winner === 'us' && servingSide === 'them'`).
6. **The server is the player at position 1 after any rotation.** PASS. `liveSet.ts` `serverId = slots[serverPosition]`.
7. **The opponent's rotations aren't needed, but the serve alternates correctly**: the rally winner serves next. PASS. `liveSet.ts` `servingSide = event.winner`.
8. **The starting line-up is per set** (it may differ between sets). PASS. `types.ts` `Match.sets: SetLineup[]`.
9. **The starting six are six different players and don't include the libero.** PASS. `lineupValidation.ts` errors `INCOMPLETE`, `DUPLICATE_PLAYER`, `LIBERO_ON_COURT`. Live mode needs all six (`matchFlow.ts` `isSetComplete`).
10. **Rotation named after the setter's position** (convention A, §1.4): setter at 4 = "rotation 4"; 6-2 back-row setter. PASS. Rotation viewer, starters overview and the live next-set setup use the formation's setter spot, so empty and incomplete courts are named too (`roles.ts` `formationRotation`, `formationSteps.ts` `formationLabels`; `src/features/rotation/RotationPanel.tsx`, `SetStartersCard.tsx`, `src/features/live/NextSetSetup.tsx`). Live play names it after the player carrying the S role (`roles.ts` `setterRotation`, `liveSet.ts` `RallyStep.setterRotation`), which is the same spot because players carry their starting spot's role.

- Note: US material often uses convention B (setter at 6 = "rotation 2"). The app labels say "setter on n", so this is unambiguous (DECISIONS #125).

11. **4-2: rotations named after the front-row (setting) setter.** NOT MODELLED. With two setters the app always names by the back-row setter (`roles.ts` `setterRotation`), which matches a 6-2 but not a 4-2.
12. **Positional faults** (overlap 4–5 / 3–6 / 2–1, left/right order in a row, server exempt; 2025–2028: receiving team only). NOT MODELLED. The app stores rotational positions only, so the order is legal by construction. It has no serve-receive or base-defence formations.
13. **Rotational fault (wrong server)** can't happen. PASS (by construction). The server is derived, never entered.

### Formations and roles

Since v5 (data model v6) a set has a **formation** (`types.ts` `Formation`: system 5-1 / 6-2, order 'outside' / 'middle', `setterAt`) that gives every court spot its role (`roles.ts` `FORMATION_PATTERNS`, `spotRole`). Players play the role of the spot they stand on. Many layout checks therefore hold by construction.

14. **5-1 template: S opposite OPP, OH opposite OH, MB opposite MB** (variant A: S1 · OH2 · MB3 · OPP4 · OH5 · MB6). PASS. `templates.ts` `fillFromTemplate` fills players into the formation's spots by role; the patterns are in `roles.ts` `FORMATION_PATTERNS['5-1']`.
15. **6-2 template: the two setters opposite, the OHs opposite, the MBs opposite** (S1 · OH2 · MB3 · S4 · OH5 · MB6). PASS. `roles.ts` `FORMATION_PATTERNS['6-2']`, `templates.ts` (`acceptedFor`: a 6-2 hitter spot also takes an OPP).
16. **Variant B (setter followed by a middle) is available.** PASS. Formation order `'middle'` (`roles.ts` `FORMATION_PATTERNS[…].middle`), chosen in the live next-set setup (`src/features/live/SetupFormationRow.tsx`) and in the lineup builder; templates fill into whichever order the set has.
17. **4-2 (and 6-6 / 6-3) templates.** NOT MODELLED. `FORMATION_SYSTEMS` / `TEMPLATE_SYSTEMS` are `['5-1', '6-2']` (owner's choice, DECISIONS #132).
18. **Warn when the one S and the one OPP aren't opposite.** PASS (by construction). The 5-1 patterns always put OPP three spots after S (`roles.ts` `FORMATION_PATTERNS`). A player listed as OPP on another spot is shown as off position (marked `*`, confirmed when placed; `roles.ts` `isOffPosition`, check 62). `UNUSUAL_LAYOUT` is no longer raised (`lineupValidation.ts`).
19. **Warn when the two MBs aren't opposite.** PASS (by construction). Both patterns put the MB spots 3 apart.
20. **Warn when the two OHs aren't opposite.** PASS (by construction). Both patterns put the OH spots 3 apart, also in a 6-2 (was FAIL before v5).
21. **Warn when two setters (6-2) aren't opposite.** PASS (by construction). The 6-2 patterns put the S spots at the setter spot and 3 after it (was FAIL before v5). A third setter in a 6-2 or a second one in a 5-1 plays the role of their spot.
22. **Layout problems are warnings, never errors** (they are legal under the rules). PASS. `lineupValidation.ts` (`valid` depends on errors only); off-position spots only ask for confirmation and are marked `*`.
23. **"No setter" is judged on the setter spot.** PASS. `NO_SETTER` is raised when no player listed as S stands on the formation's setter spot(s) (`lineupValidation.ts`, `spotRole(set.formation, p) === 'S'`; was FAIL before v5, when it looked at roster positions of all starters).

### Libero

24. **The libero only ever stands in the back row (1, 5, 6), never in the front row.** PASS. `liberoSwap.ts` `eligiblePositions` (from `BACK_ROW_POSITIONS`).
25. **The libero never stands at position 1 while their team serves** (no libero serve, FIVB 19.3.1.3). PASS. `liberoSwap.ts` (`serving` excludes position 1), `liveSet.ts` `liveCourtView` (`serving: state.servingSide === 'us'`). The rotation viewer always treats position 1 as serving (DECISIONS #61), so it never shows the legal "libero at 1 while receiving" case. That's a simplification, not a rule breach.
26. **The libero may stand at 1 while receiving.** PASS in live mode (`liveCourtView`). Not shown in the rotation viewer (see 25).
27. **Only one libero on court; they replace one player at a time.** PASS. `liberoSwap.ts` `findLiberoSwap` (single `liberoId`, first match wins).
28. **The libero isn't a substitution and isn't counted in the 6.** PASS. Libero swaps are derived, not events. A sub bringing the libero in is skipped as `INVALID_SUB` / `IN_IS_LIBERO` (`liveSet.ts` `invalidReason`). A sub "out" for the libero isn't possible because the libero isn't in the real slots.
29. **A team can play without a libero** (none chosen, or switched off). PASS. `liberoId: null`; `liberoActive: false` → `activeLiberoReplaces` returns `[]` (`liberoSwap.ts`).
30. **Default: the libero replaces the middles.** PASS. `liberoSwap.ts` `suggestLiberoReplaces` (role MB); `templates.ts` sets it after a fill.
31. **A substitute for a replaced player is replaced by the libero too** (the libero replaces a role/position). PASS. `liveSet.ts` (`liberoReplaces` mapped on each sub), DECISIONS #130.
32. **A second libero** (up to 2 per match, one on court; mandatory with >12 players in FIVB senior play). NOT MODELLED. One `liberoId` per set. A different libero per set is possible, which covers "two liberos used in different sets" but not switching liberos within a set.
33. **A completed rally between two libero replacements.** NOT MODELLED. Swaps are computed per rally and never "pending". This matters only for strict replay, not for a lineup app.
34. **A designated libero doesn't play as a regular player in the same match.** NOT MODELLED. The app allows a player to be the libero in set 1 and a starter in set 2 (no cross-set check in `lineupValidation.ts` or `lineupEditing.ts`).
35. **Point tags only name plausible players**: a block only a front-row player (positions 2, 3, 4) on court during that rally, never the libero (FIVB 14.6.2, 19.3.1.3); an ace only our server of that rally; a kill anyone on court except the libero (FIVB 19.3.1.2); our error anyone on court. PASS. `lastRally.ts` `plausiblePlayerIds` (front row from the rally's court with the libero swap applied), used by `src/features/live/TagPlayerPicker.tsx`; the ace tag pre-selects the server (`PointTagRow.tsx`). A player already tagged with that kind stays listed so an older tag can still be cleared. Note: a back-row player's kill from behind the attack line is legal, so kills aren't limited to the front row.
36. **Libero serving in one rotation (NCAA / USAV).** NOT MODELLED. Correct for FIVB/DVV.

### Substitutions

37. **At most 6 substitutions per set.** PASS (as a warning). `liveSet.ts` `MAX_SUBS_PER_SET = 6`, `SUB_LIMIT`. The 7th is recorded with a warning, not blocked (DECISIONS #66).
38. **A starter leaves once and re-enters once, only for their own substitute. A substitute enters once and only leaves for that starter.** PASS (as a warning). `liveSet.ts` partner/pair tracking, `REENTRY_RULE` for a different partner or a third use of a pair.
39. **The substitute takes the replaced player's position (rotational order kept), and inherits their role.** PASS. `liveSet.ts` (same slot; `roles[inPlayerId] = outRole`).
40. **Exceptional substitution for injury** (outside the limits). NOT MODELLED. It shows as `SUB_LIMIT` / `REENTRY_RULE` warnings. Since warnings don't block, the manager can still record it.
41. **Configurable substitution limit (e.g. NFHS 18, youth rules).** NOT MODELLED. Fixed at 6.

### Scoring and serve

42. **A set is won at 25 with a 2-point lead, with no cap (26–24, 30–28 …).** PASS. `liveSet.ts` `setWinnerOf`, `targetPoints`.
43. **Set 5 is won at 15 with a 2-point lead.** PASS. `liveSet.ts` `targetPoints` (`setNumber === 5 ? 15 : 25`).
44. **Set point = one rally from winning (target − 1 and ahead, deuce included).** PASS. `liveSet.ts` `setPointOf`.
45. **The match is won at 3 sets (best of 5); later sets don't count.** PASS. `matchState.ts` `SETS_TO_WIN = 3`, `getMatchState`.
46. **No rallies are recorded in a set that's already won.** PASS (UI). `src/features/live/LiveSetView.tsx` shows `SetWonPanel` instead of the point buttons. `liveSet.ts` `addPoint` itself doesn't refuse.
47. **First serve of set 1 = the toss result (entered by the manager).** PASS. `SetLineup.weServeFirst`.
48. **Sets 2–4 are started by the team that didn't serve first in the previous set.** PASS (as the default). `matchFlow.ts` `defaultWeServeFirst`, `withDefaultServe`.
49. **Set 5's first serve comes from a new toss.** PASS (manual). The next-set setup asks for the serve choice for every new set (PLAN §15.1). `matchFlow.ts` `defaultWeServeFirst` pre-fills alternation for set 5 too, which is only a default; the manager must enter the toss result.
50. **Changing ends after each set, and at 8 points in set 5.** NOT MODELLED. Not needed for lineups or score; a "change ends" hint at 8 in set 5 would be a nice-to-have.
51. **Time-outs (2 per set).** NOT MODELLED.
52. **Best-of-three match formats (youth, tournaments).** NOT MODELLED. `SETS_TO_WIN` and the 15-point set are fixed to set 5.

### Formation patterns (v5)

53. **5-1, setter followed by an outside: S · OH · MB · OPP · OH · MB** from the setter spot up the position numbers (§2.1 variant A). PASS. `roles.ts` `FORMATION_PATTERNS['5-1'].outside`; all six rotations as literal layouts in `formationSteps.test.ts`.
54. **5-1, setter followed by a middle: S · MB · OH · OPP · MB · OH** (§2.1 variant B). PASS. `FORMATION_PATTERNS['5-1'].middle`; literal layouts in `formationSteps.test.ts`.
55. **6-2: S · OH · MB · S · OH · MB, or S · MB · OH · S · MB · OH** (§2.2). PASS. `FORMATION_PATTERNS['6-2']`; literal layouts in `formationSteps.test.ts`, `roles.test.ts`.
56. **In every rotation the pairs 1–4, 2–5, 3–6 have the same kind of role** (S–OPP or S–S, OH–OH, MB–MB), so exactly one of each pair is in the front row. PASS (by construction). Every pattern repeats after 3 spots; checked for all systems, orders and steps in `formationSteps.test.ts`.
57. **5-1: three front-row attackers when the setter is in the back row (rotations 1, 6, 5), two when in front (4, 3, 2).** PASS (by construction). Follows from 53–56: with S at 1, 5 or 6 the front row holds one OH, one MB and the OPP.
58. **6-2: one setter is always in the back row, so the rotations are named 1, 6, 5 twice.** PASS. `roles.ts` `formationRotation` (back-row setter spot), `formationSteps.ts` `formationLabels`; `src/features/rotation/RotationStepper.tsx` tells the two apart ("first / second time").
59. **The formation turns with the players** (rotating before the set, and rotation by rotation in the viewer), so everyone keeps their role. PASS. `roles.ts` `rotateStarters` (moves `setterAt` like a player), `formationSteps.ts` `rotateFormation`, `stepSpotRoles`.
60. **Every spot has its role, also when empty**, on every court. PASS. Rotation viewer, starters overview and team starters (`src/features/rotation/RotationCourt.tsx` `spotRoles`, `formationSteps.ts` `stepSpotRoles`), print sheet (`lineupSheet.ts` `roleTag`), live court (always six players; `LiveState.roles`) and the lineup builder court (`src/features/lineup/LineupCourt.tsx`).
61. **The formation is locked once a set is played**, like the starting six. PASS. `roles.ts` `setFormation`, `rotateStarters` (`isLineupLocked`).
62. **A player on a spot whose role is none of their positions is "off position"**: legal, but confirmed and marked with `*`. PASS. `roles.ts` `isOffPosition`; the `*` via `OffPositionMark` on every court and `<span class="off">` in the print sheet. A formation change in the live next-set setup that puts starters onto such roles asks first and Cancel keeps the old formation (`formationChange.ts` `changeFormation`, `placementCheck.ts` `newOffPositionPlacements`, `src/features/live/FormationConfirm.tsx`); placing a player or changing the formation in the lineup builder asks the same way (`placementCheck.ts` `newOffPositionPlacements`, `src/features/lineup/PlacementConfirm.tsx`).

### Summary of non-PASS checks

- **FAIL**: none. (Fixed in v5: 20 and 21 by the formation, 23 by judging the setter spot, 35 by the point-tag player check.)
- **NOT MODELLED**: 11 (4-2 rotation naming), 12 (overlap / positional faults), 17 (4-2 / 6-6 / 6-3 templates), 32 (second libero), 33 (rally between libero replacements), 34 (libero playing as a regular player in another set), 36 (libero serve, US rules), 40 (exceptional substitution), 41 (configurable sub limit), 50 (changing ends), 51 (time-outs), 52 (best of three).
