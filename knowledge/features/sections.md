---
type: Feature
title: Sections
description: Separate spaces (Work, Home…), each with its own wheel, swipe deck and Working on & done tickets, picked from a list on the left.
tags: [feature, sections]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
verified: { by: process:headless-chromium-check, at: 2026-11-27T12:20:00Z }
sources:
  - { id: app, resource: ../../app.js, title: app.js }
  - { id: request, resource: "owner request in session project-spinwheel-5, 2026-11-27", title: Owner request }
---

Status `draft`: built and tested on branch `ao/project-spinwheel-5/sections`,
not merged into `main` yet (2026-11-27).

# What the owner asked for

"A section list on the left, where I can select, and it jumps to that space,
with its own wheel/cards and the list of working-on and open items", plus
import and export that bring back all sections with their items.[^request]

# UI

| Element | id | Notes |
|---|---|---|
| Nav | `#sections`, list `#section-list` | Buttons `.section-pick` with `aria-current="true"` on the active one; meta line "N on the wheel · M working" |
| New | `#section-new` | Opens `#section-dialog` in "new" mode; creates and switches |
| Title | `#section-title` | Above the mode switch in the stage |
| Rename / Delete | `#section-rename`, `#section-delete` | Act on the active section. Delete hidden when only one section |
| Dialogs | `#section-dialog` (new/rename, one dialog), `#delete-dialog` | `<form method="dialog">`; validation errors keep the dialog open |

Layout: at 1100 px and up the nav is its own left column (sticky). Below that
it's a sideways-scrolling strip of pills above the stage; under 520 px the
"Sections" label is hidden and the active pill is scrolled into view
(`revealActiveSection`, horizontal only so the page doesn't jump).

# Behaviour

- Switching: `switchSection` → `resetView()` + `selectSection`, saved, so
  the active section is remembered. Announces "Now in X".
- Blocked while spinning or while a swipe card is flying.
- Name lists and old backups import into the current section; v2 backups
  import all sections. See [backup format](/architecture/backup-format.md).
- Data model and functions: [data model](/architecture/data-model.md).

# Checked

44 logic tests (11 for sections) and a headless Chromium run covering
migration, create/duplicate-name error/rename/delete/switch, swipe within a
section, export, merge import, reload, and spinning (nav inert), with
screenshots at 1440, 960, 400 and 360 px. Not loaded as an actual extension.

[^request]: Owner request
