---
description: Wrap up this chat — update docs/HANDOFF.md with the most important things the next chat must know, then commit, push and merge it.
---

The owner is about to close this chat (context limit). Make sure the next chat can continue without this conversation.

1. Collect the facts (verify, don't guess):
   - Current app version (`app.json`, `package.json`), store version (`src/store/migrations.ts`), export `schemaVersion` (`src/domain/exportSchema.ts`).
   - Latest release (GitHub MCP `get_latest_release`) and whether any release build is still running.
   - Last decision number in `docs/DECISIONS.md`.
   - Test count and coverage from `npm test -- --coverage` (run it), CI status of `main`.
   - Open PRs (`list_pull_requests` state open) and running/unfinished agents or workflows.
2. Update `docs/HANDOFF.md`:
   - "Last updated" line (date + latest release).
   - §1 version table (add rows for anything released in this chat), current versions, test count, last decision number.
   - §1 open items / known gaps: add new ones, remove fixed ones. Include anything half-done in this chat (open PRs, unverified features, owner requests not yet done) with enough detail to resume.
   - §1 ideas for next versions: add anything the owner asked for or mentioned.
   - §3 architecture: new routes, domain modules, features, data model changes.
   - §6 gotchas: anything new learned the hard way in this chat.
   - Keep it concise — facts the next chat needs, not a diary.
3. Also make sure `docs/DECISIONS.md`, `docs/PLAN.md` (checklists ticked) `docs/README_LEGACY.md` (a Version history section for every new version) and `README.md` ("What's new" line, install steps if they changed) reflect what was built in this chat.
4. Commit on a branch (`docs/handoff-<date>`), push, open a PR into `main`, wait for green CI, merge it. Also push the session branch so it is in sync with `main`.
5. Tell the owner, in a few lines:
   - the handoff is updated (link to `docs/HANDOFF.md` on GitHub),
   - what's open,
   - to start the next chat with `/start <what to build next>`.
