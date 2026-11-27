---
type: Reference
title: Storage
description: localStorage keys the app uses, how old saves migrate, and how two open windows stay in step.
tags: [architecture, storage, migration]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: logic, resource: ../../logic.js, title: logic.js }
  - { id: app, resource: ../../app.js, title: app.js }
---

# Keys

| Key | Holds | Since |
|---|---|---|
| `spinwheel:v2` | The workspace JSON (all sections). Written on every change | 2026-11-27 |
| `spinwheel:v1` | Old single-wheel state. Read once for migration, **never written or deleted** now | 2026-11-21 |
| `spinwheel:mode` | `'spin'` or `'swipe'`, global | 2026-11-23 |

# Loading

`loadWorkspace(storage)`:[^logic]

1. Parse `spinwheel:v2` and clean it (bad sections dropped, ids deduped,
   unknown `activeId` → first section). Use it if at least one section survives.
2. Otherwise read `spinwheel:v1` with `loadState`; if it has anything, it
   becomes the only section, "My projects".
3. Otherwise an empty workspace. Never throws: storage errors and bad JSON
   fall through.

If saving fails (blocked storage, quota), the footer says changes last only
until the tab closes.

# Two windows

The extension's side panel and a full tab share storage. `app.js` listens
for the `storage` event on `spinwheel:v2`, reloads, and keeps its own
`activeId` if that section still exists. Ignored while that window is spinning.[^app]

# Website vs extension

They are different origins, so their data is separate. Moving data means
Export on one and Import on the other.

[^logic]: logic.js
[^app]: app.js
