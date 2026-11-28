---
type: Playbook
title: Git and PRs
description: Branch naming, commit style and PR history for the spinwheel repo, including the stacked-PR mistake to avoid.
tags: [workflow, git, github]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: gh, resource: "https://github.com/Arskan17/project-spinwheel/pulls?q=is%3Apr", title: Pull requests }
---

# Conventions

- Default branch `main`; GitHub Pages deploys from it.
- Work happens in Orchestrator worktrees on `ao/<session>/root`; PR branches are
  siblings like `ao/project-spinwheel-5/sections`.
- Conventional commits (`feat:`, `fix:`, `docs:`), small and focused;
  usually logic + tests, then UI, then docs.
- The README is the user-facing doc: update it with every feature.
- Push and open PRs only when the owner asks.

# PR history[^gh]

| PR | Branch | What | Merged (UTC) |
|---|---|---|---|
| #1 | ao/project-spinwheel-3/spinwheel-app | Wheel, pile, storage | 2026-11-21 10:13 |
| #2 | ao/project-spinwheel-2/import-export | Export/import, name lists | 2026-11-22 07:59 |
| #3 | ao/project-spinwheel-3/swipe-mode | Swipe mode | 2026-11-23 22:04 |
| #4 | ao/project-spinwheel-4/chrome-extension | Chrome extension | 2026-11-26 18:18 |
| #5 | ao/project-spinwheel-4/chrome-sync | Chrome sync, **into #4's branch, not main** | 2026-11-26 18:19 |

# Lesson: stacked PRs

Merging the parent PR first and then the child leaves the child on a dead
branch (what happened to #5, see [Chrome sync](/features/chrome-sync.md)).
Merge the child into the parent first, or retarget the child to `main`
before merging. Check with `git branch -r --contains <merge-sha>`.

[^gh]: Pull requests
