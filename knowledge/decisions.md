---
type: Decision Record
title: Design decisions
description: Choices already made for the spinwheel and the reasons, so new sessions don't reopen them.
tags: [decisions, design]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T14:10:00Z }
sources:
  - { id: design, resource: ../docs/superpowers/specs/2026-11-21-spinwheel-design.md, title: Original design spec }
  - { id: sections-session, resource: "session project-spinwheel-5 (2026-11-27)", title: Sections implementation session }
---

# Stack

- **Plain HTML/CSS/JS, no build.** Framework + bundler and Rust/WASM were
  considered and rejected as too much fuss.[^design]
- **Randomness from `crypto.getRandomValues`**, and the spin lands at a random
  offset inside the slice, away from borders, so it never looks rigged.[^design]
- **Fonts and icons bundled** (no Google Fonts request), so the extension and
  the site work offline and make no third-party requests.

# Behaviour

- Project names: trimmed, at most 60 characters, case-insensitive duplicates
  rejected **within a wheel**. The same name may exist in different sections.
- Picking moves a project from the wheel to the top of the pile (newest first).
  "Back to wheel" appends it to the end of the wheel.
- The Spin/Swipe choice is **global**, not per section.
- Swipe: a skipped card never comes straight back; projects added mid-round
  join at the next reshuffle.

# Sections (2026-11-27)[^sections-session]

- Every section has its own wheel, pile and swipe deck. Projects can't be moved
  between sections (not asked for; could be added later).
- At least one section always exists; the last one can't be deleted.
- Switching section resets the wheel rotation and starts a fresh shuffle.
- Section switching is blocked while the wheel spins or a card is flying.
- **Export always includes every section.** No per-section export.
- **Import merge matches sections by id, then by name** (case-insensitive);
  unmatched ones are added as new sections. Replace swaps the whole workspace.
- An old single-wheel backup or a name list goes into the **current** section.
- Old saves under `spinwheel:v1` are migrated into a section called
  "My projects"; the v1 key is **left in place** as a safety copy.
- Item ids only need to be unique **inside a section**; every item operation
  works within one section. Deduping them across sections on load lost data
  (caught in review of PR #6).
- Two windows (side panel + tab) may show different sections; a storage event
  keeps each window on its own section if it still exists.

[^design]: Original design spec
[^sections-session]: Sections implementation session
