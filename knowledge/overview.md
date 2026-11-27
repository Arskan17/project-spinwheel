---
type: Project Overview
title: Project spinwheel
description: A static web app (and Chrome extension) that spins a wheel of your projects to pick what to work on next.
resource: https://github.com/Arskan17/project-spinwheel
tags: [overview, onboarding]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: readme, resource: ../README.md, title: README }
  - { id: design, resource: ../docs/superpowers/specs/2026-11-21-spinwheel-design.md, title: Original design spec }
---

# What it is

A personal "what do I work on next?" picker. You add projects; each is a slice
on a wheel. Spin (or swipe through cards) and the pick leaves the wheel and
becomes a ticket in **Working on & done**, where you tick it off or put it
back. Since 2026-11-27 projects can be grouped into [sections](/features/sections.md),
each with its own wheel and tickets.[^readme]

# Where it runs

| Target | How | Notes |
|---|---|---|
| GitHub Pages | Static files from `main`, repo root | Owner: `Arskan17` |
| Chrome extension | Load unpacked, opens in the side panel | See [Chrome extension](/features/chrome-extension.md) |
| Locally | Any static file server | ES modules don't load from `file://` |

All data lives in the browser's localStorage. Website and extension have
separate storage; [export and import](/architecture/backup-format.md) move data between them.

# Ground rules

- **No build step, no package.json, no dependencies.** Plain HTML, CSS and ES
  modules served as they are. This was the owner's main wish: least fuss.[^design]
- Pure logic goes in `logic.js` (tested, no DOM); everything touching the
  page goes in `app.js`. See [modules](/architecture/modules.md).
- Never crash on bad saved data or bad imports: clean it or start empty.
- Accessibility floor: works at 360 px wide, visible focus, reduced motion
  respected, live-region announcements for changes.

# Where to look next

- [Data model](/architecture/data-model.md) and [storage](/architecture/storage.md)
- [Run and test](/workflows/run-and-test.md)
- [Design decisions](/decisions.md)

[^readme]: README
[^design]: Original design spec
