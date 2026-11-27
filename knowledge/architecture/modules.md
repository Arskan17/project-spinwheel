---
type: Code Map
title: Modules
description: Which file does what in the spinwheel, and the rule that pure logic lives in logic.js and DOM code in app.js.
tags: [architecture, files]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: code, resource: ../../, title: Repository root }
---

# Files

| File | Role |
|---|---|
| `index.html` | Markup: sections nav, stage (section head, mode switch, deck, wheel), side column (add form, lists, backup), dialogs |
| `style.css` | All styles. Dark "ticket booth at dusk" look, see [visual design](/features/visual-design.md) |
| `logic.js` | **Pure** functions, no DOM: item changes, sections, storage load/save, backup parsing, swipe deck, spin geometry |
| `app.js` | Everything on the page: rendering, canvas wheel, spin animation, swipe drag, dialogs, export/import, section UI |
| `tests.js`, `tests.html` | Tests for `logic.js` only. See [run and test](/workflows/run-and-test.md) |
| `manifest.json`, `background.js` | Chrome extension (side panel). See [Chrome extension](/features/chrome-extension.md) |
| `icons/`, `fonts/` | Wheel icon (SVG + PNG sizes), bundled Bricolage Grotesque + OFL licence |
| `docs/superpowers/` | Original design spec and plan from 2026-11-21 |

# The split

- `logic.js` functions take state and return **new** state; they never mutate
  input (there's a test for that). Anything you can test without a browser
  belongs here.
- `app.js` holds the live variables and calls into `logic.js`.

# app.js essentials

- `ws` is the whole workspace; `state` is the active section's
  `{ wheel, pile }`. All wheel/deck/ticket code reads `state` and was not
  changed when sections came in.
- `commit(next, message)` writes a new `{ wheel, pile }` into the active
  section; `commitWs(next, message)` replaces the workspace. Both save, call
  `render()`, and put `message` into the `#announce` live region.
- `render()` redraws everything from state: sections, wheel list, pile, mode,
  card, canvas. Lists are rebuilt with `replaceChildren`, so restore focus
  after changes (see `focusAfterRemoval`, `focusActiveSection`).
- `setBusy(true)` during a spin makes the side column and sections nav
  `inert`. The Spin button uses `aria-disabled`, not `disabled`, so it keeps
  keyboard focus.
- `resetView()` zeroes rotation and the swipe deck; called on section switch,
  new section, delete and replace-import.
- Event handling is delegated on the lists via `data-action` / `data-id`.
