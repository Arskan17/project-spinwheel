---
type: Feature
title: Chrome sync (not on main)
description: PR 5 syncs the extension's projects through chrome.storage.sync, but it was merged into a side branch and never reached main.
tags: [feature, chrome, sync, open-issue]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: pr5, resource: https://github.com/Arskan17/project-spinwheel/pull/5, title: "PR #5 feat: sync the extension's projects with Chrome sync" }
  - { id: faq, resource: "git show 88a5367:docs/faq.md", title: FAQ on the PR 5 merge commit }
---

# Status (checked 2026-11-27)

PR #5 targeted `ao/project-spinwheel-4/chrome-extension` (a stacked PR).
PR #4 merged that branch into `main` at 2026-11-26 18:18:46 UTC; PR #5 merged
into the branch 19 s later, so its merge commit `88a5367` is **only on the
side branch**, not on `main`.[^pr5]

To ship it, someone has to bring `88a5367` into `main` (new PR) and **rework
it for sections**: it changes `app.js`, `logic.js`, `tests.js`,
`manifest.json` and `README.md`, and adds `docs/faq.md`, all written for
the single-wheel state. Ask the owner before doing this.

# What it does

- Uses `chrome.storage.sync` in the extension only (8 KB per entry,
  512 entries, ~100 KB total), storing each project as its own entry.
- Adds a manifest `key` so the unpacked extension ID is fixed
  (`eenecdadhengejemgbbkajeogdehcfbo`) on every computer; Chrome syncs by ID.
- First start copies existing local data into sync once, merging like Import.
- Concurrent edits: different projects merge; same project, last write wins.
- Limits: about 500 projects; over quota shows **Not saved**.[^faq]

[^pr5]: PR #5
[^faq]: FAQ on the PR 5 merge commit
