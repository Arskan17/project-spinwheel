---
type: Data Model
title: Data model
description: Shape of the workspace, sections, wheel items and tickets, and the rules each field follows.
tags: [architecture, state, sections]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: logic, resource: ../../logic.js, title: logic.js }
---

# Schema

```js
// Workspace (since 2026-11-27, storage key spinwheel:v2)
{
  sections: [
    {
      id: "uuid",
      name: "Work",                       // 1-60 chars, unique per workspace (case-insensitive)
      wheel: [{ id: "uuid", name: "Slides" }],
      pile:  [{ id: "uuid", name: "Report", done: false, pickedAt: 1764240000000 }]
    }
  ],
  activeId: "uuid"                        // id of the section on screen
}
```

A section's `{ wheel, pile }` is exactly the pre-sections state, so
`addProject`, `removeProject`, `confirmPick`, `toggleDone`,
`returnToWheel`, `addNames` and `mergeBackup` all work on one section.[^logic]

| Field | Rule |
|---|---|
| `id` | `crypto.randomUUID()`, fallback time + random. Kept unique when loading/importing (across sections too) |
| `name` (project) | Trimmed, cut to 60 chars (`MAX_NAME_LENGTH`), case-insensitive unique **within a wheel** |
| `name` (section) | Same cleaning; duplicates on import get " 2", " 3"… appended |
| `pile` order | Newest pick first; merges re-sort by `pickedAt` |
| `pickedAt` | ms timestamp, must be finite and within ±8.64e15 (else Intl date formatting throws) |
| `done` | boolean |

# Section functions (logic.js)

| Function | Does |
|---|---|
| `emptyWorkspace()` | One empty section "My projects" |
| `activeSection(ws)` | Active section, or the first one |
| `selectSection(ws, id)` | Switch; unknown id leaves ws unchanged |
| `updateSection(ws, id, data)` | Replace a section's wheel and pile |
| `addSection`, `renameSection` | Return `{ ws, error }`, error `'empty'` or `'duplicate'`. Add switches to the new one |
| `removeSection(ws, id)` | Keeps the last section; active moves to the next, or previous at the end |
| `isEmptySection`, `isBlankWorkspace` | Used to import straight away without asking |
| `mergeWorkspace(ws, incoming)` | See [backup format](/architecture/backup-format.md) |

[^logic]: logic.js
