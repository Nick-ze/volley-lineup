---
description: Start a new Volley Lineup work session — read the handoff and docs, check the repo, then continue with the next version.
argument-hint: [what to build next, optional]
---

You are continuing the **Volley Lineup** project in a fresh chat. Do this before anything else:

1. Read, in this order and completely:
   - `CLAUDE.md` (binding rules)
   - `docs/HANDOFF.md` (current state, how work is done here, release steps, gotchas)
   - `docs/PLAN.md` (features and data model, all versions)
   - `docs/DECISIONS.md` (skim all headings; read entries related to the task)
   - `docs/README_LEGACY.md` (version history + development; the short `README.md` is for app users)
   - `docs/WORKER_BRIEF.md` only if you will start worker agents (note the outdated parts listed in HANDOFF §2)
2. Get the repo ready:
   - `git fetch origin main`, then check out or create the branch this session is told to use, based on `origin/main`.
   - `npm ci`, then `npm run lint && npm run typecheck && npm test` — report if anything is red before changing code.
   - Check the latest release (GitHub MCP `get_latest_release`) and that the version in `app.json` / `package.json` matches HANDOFF §1.
3. Summarise for the owner in a few lines: current version, what's open (HANDOFF §1), and what you'll do next.
4. Then work on the task: **$ARGUMENTS**
   - If no task was given, ask the owner which items from HANDOFF "Ideas for next versions" they want — or wait for their request.
   - Follow the orchestrator pattern in HANDOFF §4 and the version checklist in HANDOFF §7.
   - Record decisions in `docs/DECISIONS.md` (continue numbering from HANDOFF §1).

Remember: the owner prefers action over questions; when a request is ambiguous, state your interpretation in one line and proceed.
