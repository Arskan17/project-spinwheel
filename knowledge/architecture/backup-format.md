---
type: Data Format
title: Backup format and import rules
description: The JSON backup files (v1 single wheel, v2 sections), name-list imports, and what Merge and Replace do.
tags: [architecture, import, export, backup]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: logic, resource: ../../logic.js, title: logic.js }
  - { id: readme, resource: ../../README.md, title: README }
---

# Schema

Export (`exportWorkspace`) writes `spinwheel-YYYY-MM-DD.json` (local date):

```json
{
  "app": "project-spinwheel",
  "version": 2,
  "exportedAt": "2026-11-27T09:00:00.000Z",
  "activeId": "…",
  "sections": [ { "id": "…", "name": "Work", "wheel": [ … ], "pile": [ … ] } ]
}
```

Version 1 (before sections) had `wheel` and `pile` at the top level instead
of `sections`. A raw localStorage value also parses as a backup.

# Parsing

`parseAnyBackup(text)` returns:[^logic]

- `{ kind: 'sections', ws }` when there's a `sections` array with at least one usable section,
- `{ kind: 'single', state }` for a v1 backup (has `wheel` or `pile`),
- `null` otherwise ("That file isn't a spinwheel backup").

A BOM is stripped. Bad items are dropped, names cleaned, ids and wheel names deduped.
Files over 1 MB are refused before reading.

# What import does

| File | App empty? | Result |
|---|---|---|
| v2 backup | Blank workspace (one empty section) | Loads straight away |
| v2 backup | Otherwise | Dialog: **Merge** (`mergeWorkspace`) or **Replace** (whole workspace) |
| v1 backup | Current section empty | Goes into the current section |
| v1 backup | Otherwise | Dialog: Merge/Replace **for the current section only** |
| `.txt` / `.csv` | any | Names added to the current section's wheel (`addNames`) |

`mergeWorkspace`: each incoming section joins the existing section with the
same id, else the same name (case-insensitive), via `mergeBackup`; the rest
are appended. The active section doesn't change. Returns `added` (projects)
and `addedSections`.

`mergeBackup` (inside one section): skips items whose id is already there and
wheel names already on the wheel; the pile is re-sorted newest first.

A file is treated as JSON if its name ends in `.json` or its text starts with `{`.

# Name lists

- `.txt`: whole line, commas included.
- `.csv`: first column; comma, semicolon or tab; quoted values work. A first
  row named `name(s)`, `project(s)` or `projekt(e)` is skipped.[^readme]

[^logic]: logic.js
[^readme]: README
