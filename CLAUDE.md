# CLAUDE.md — Volley Lineup

Read this file, `docs/HANDOFF.md` (current state + how work is done here) and `docs/PLAN.md` before doing any work. In a new chat, run `/start`; before closing a chat, run `/wrap-up`. The plan is the source of truth for features, data model, screens and design. If something you need isn't in the plan, choose the simplest option, write it down in `docs/DECISIONS.md`, and continue.

## Project

Expo (React Native + web) app for volleyball team managers: roster, per-set lineups with drag and drop, rotation viewer, local storage, JSON export/import. No backend.

## Commands

- `npm install`: install dependencies
- `npx expo start`: dev server (press `w` for web; scan the QR code with Expo Go)
- `npm run lint`: ESLint
- `npm run format:check`: Prettier (`npm run format` fixes)
- `npm run typecheck`: `tsc --noEmit`
- `npm run check`: all of lint, format, typecheck and tests
- `npm test`: Jest
- `npx expo export -p web`: production web build

Before every commit: `npm run check` (lint, format:check, typecheck, tests) must pass.

## Folder structure

```
app/                  Expo Router screens (thin: layout + wiring only)
src/domain/           Pure TypeScript logic (rotation, validation, import/export schema). No React, no storage.
src/store/            Zustand stores + persistence
src/components/       Reusable UI (Court, PlayerChip, Bench, Button, ...)
src/features/<name>/  Feature-specific components and hooks
src/theme/            colors.ts, spacing.ts, typography.ts
src/i18n/en/*, de/*   All user-facing strings (German typed from English)
src/lib/              Platform helpers (file export/import for web vs native)
src/test-utils/       Shared test helpers and fixtures
__tests__/ or *.test.ts(x) next to the code
docs/                 PLAN.md, DECISIONS.md, HANDOFF.md, README_LEGACY.md (version history + dev guide)
```

## Code rules

- TypeScript strict mode; no `any` and no `@ts-ignore` without a comment explaining why.
- Business logic lives in `src/domain` as pure functions with unit tests. Screens never contain rotation or validation logic.
- Components are functional with hooks, small and focused (aim for under 150 lines).
- Never hard-code colours, spacing or user-facing text: use `src/theme` and `src/i18n` (`useT()`).
- Types from the data model in `docs/PLAN.md` live in `src/domain/types.ts`; do not redefine them elsewhere.
- Changing the persisted data shape requires bumping `schemaVersion` and adding a migration.
- Code that differs per platform goes in `src/lib` using `.web.ts` / `.native.ts` files, never `Platform.OS` checks scattered through screens.
- Accessibility: every interactive element has an `accessibilityLabel`; touch targets are at least 44×44 px; drag and drop always has the tap-to-select alternative.
- Add a dependency only if it is Expo-compatible (`npx expo install <pkg>`), and note why in `docs/DECISIONS.md`.

## Testing

- `src/domain` targets 100% coverage. Rotation tests must cover all 6 rotations and the clockwise rule.
- Each feature needs at least one component test for its main flow (React Native Testing Library).
- Export/import needs a round-trip test and tests that reject invalid files.
- Never weaken or delete a test to make it pass. Fix the code, or explain in the PR why the test was wrong.

## Git workflow

- `main` is always green and deployable.
- One branch per task: `feat/<short-name>`, `fix/<short-name>`.
- Small commits with clear messages (`feat(lineup): drag player from bench to court`).
- Open a pull request into `main` with: what changed, how it was tested, screenshots/notes for UI changes, and which acceptance checklist items it covers.
- Never force-push to `main`. Never commit secrets.

## Working with other agents

- Stay inside the files your task owns. If you must change a shared file (`src/domain/types.ts`, `src/theme/*`, `src/store/*`), keep the change minimal and mention it in the PR description.
- Don't refactor code outside your task.
- When you finish, report: branch name, PR link, what's done, what's not done, and any open questions.

## READMEs

- `README.md` is for people using the app: what it is, install (APK), Expo Go, browser, backup. Keep it short and plain; update its "What's new" line when users see a change.
- `docs/README_LEGACY.md` is for developers and AI agents: the full version history and the development guide. Add a "Version history" section for every new version.

## Definition of done

A task is done when lint, typecheck and tests all pass, the feature works on web (checked with `npx expo export -p web` succeeding and, where possible, a browser check), the relevant acceptance items in `docs/PLAN.md` are met, and a PR is open.
