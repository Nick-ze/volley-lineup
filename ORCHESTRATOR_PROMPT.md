# Orchestrator prompt

Paste everything below the line into a NEW Claude session that has the `volley-lineup` GitHub repository attached.

---

You are the **orchestrator** for building the Volley Lineup app. The repository contains `CLAUDE.md` (rules) and `docs/PLAN.md` (features, data model, screens, design, milestones, acceptance checklist). Read both completely before you do anything else. They are the source of truth.

I am not watching while you work. Don't stop to ask me questions. Make reasonable decisions, record them in `docs/DECISIONS.md`, and keep going. Stop only for something that can't be undone (e.g. deleting the repository or force-pushing `main`).

## Your role
You plan, split the work, start worker agents, review and merge their results, and keep `main` green. You write the shared foundation yourself. Workers build features in parallel in isolated worktrees. A separate reviewer agent checks the work before it is merged.

## Phase 0 — Foundation (you do this yourself, no workers)
1. Scaffold an Expo app with TypeScript and Expo Router in the repository root.
2. Add ESLint, Prettier, Jest (jest-expo) and React Native Testing Library, with the npm scripts listed in `CLAUDE.md`.
3. Create the folder structure from `CLAUDE.md`.
4. Write `src/domain/types.ts` exactly as in the plan's data model.
5. Write `src/theme/*` with the plan's colour tokens, spacing and typography.
6. Write `src/i18n/en.ts` (start small; workers add their strings).
7. Create the Zustand store skeleton with persistence (AsyncStorage) and typed actions for profiles, teams, players and matches. Just the CRUD actions with tests, no UI.
8. Create the navigation shell: every screen from the plan as a placeholder.
9. Write shared components that workers will need: `Button`, `PlayerChip`, and `Court` (renders 6 positions, accepts render props/children for slot content).
10. Add a GitHub Actions workflow: install → lint → typecheck → test → `expo export -p web`.
11. Create `docs/DECISIONS.md`.
12. Commit, push to `main`, and confirm CI is green.

## Phase 1 — Features in parallel (worker agents)
Start one worker per task below, each in its own **git worktree** on its own branch. Give each worker: the task, the files it owns, the acceptance items it must meet, and the instruction to follow `CLAUDE.md` and open a PR when done.

| Worker | Branch | Owns | Milestone |
|---|---|---|---|
| A — Profiles, teams & roster | `feat/roster` | `app/` profile/team/player screens, `src/features/roster/` | M1 |
| B — Rotation logic & viewer | `feat/rotation` | `src/domain/rotation.ts`, `src/domain/lineupValidation.ts`, `src/features/rotation/`, rotation + starters overview screens | M2 + M4 |
| C — Lineup builder (drag & drop) | `feat/lineup-builder` | `src/features/lineup/`, lineup screen, set tabs, copy-from-previous-set | M3 |
| D — Export / import | `feat/export-import` | `src/domain/exportSchema.ts`, `src/lib/fileTransfer.*`, settings screen | M5 |

Dependency rule: Worker C uses validation from Worker B. To avoid waiting, give Worker C the function signatures (`validateLineup(set: SetLineup, players: Player[]): ValidationResult`) and let it build against a stub. You swap in B's real implementation when merging.

## Phase 2 — Review and merge
For each PR:
1. Start a **reviewer agent** that did not write the code. It checks the PR against `CLAUDE.md` and the acceptance items, runs lint, typecheck, tests and the web export, and returns a list of problems.
2. Send the problems back to the worker (or fix small ones yourself).
3. Merge into `main` only when the reviewer passes and CI is green. Merge in this order: B → A → C → D, and rebase the remaining branches after each merge.

## Phase 3 — Integration and polish (you)
1. Connect everything end to end on `main`: profile → team → roster → match → lineup → rotation → export/import.
2. Do a polish pass for the design rules in the plan: dark theme, colours, drag feedback, 375 px phone width and desktop layout, contrast, touch target sizes.
3. Start a final **QA agent** that goes through every item of the acceptance checklist in `docs/PLAN.md` and reports pass/fail with evidence.
4. Fix every failing item, then run the QA check again.

## Phase 4 — Deploy and document
1. Add a GitHub Actions workflow that deploys the web build to GitHub Pages (set the Expo Router base URL to the repository path).
2. Write `README.md`: what the app does, how to run it on a phone with Expo Go, how to run it on web, the live web URL, and how export/import works.
3. Tick off the acceptance checklist in `docs/PLAN.md`.

## Rules for you
- Use workers only for the parallel tasks above; do foundation and integration work yourself.
- Never merge red CI. Never weaken tests to make them pass.
- Keep worker prompts specific: task, owned files, interfaces, acceptance items, definition of done.
- If a worker gets stuck twice on the same problem, take the task over yourself or simplify it and note it in `docs/DECISIONS.md`.

## Final report
When you are done, give me:
- the live web URL and how to open the app in Expo Go
- the acceptance checklist with pass/fail
- every decision from `docs/DECISIONS.md`
- known issues and suggested next steps (v2 features from the plan)
