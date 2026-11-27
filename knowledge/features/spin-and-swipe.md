---
type: Feature
title: Spin, swipe and tickets
description: Picking a project by spinning the wheel or swiping cards, and the Working on & done pile it lands in.
tags: [feature, wheel, swipe, tickets]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: readme, resource: ../../README.md, title: README }
  - { id: logic, resource: ../../logic.js, title: logic.js }
---

# Spin

- The hub is the Spin button. Spin lasts 4.5 s (0.6 s with reduced motion),
  5–8 full turns, ease-out cubic, landing 15–85 % into a uniformly picked slice.
- Geometry in `logic.js`: `pickIndex`, `targetRotation`, `indexAtPointer`.
  Slice i spans `[i·w, (i+1)·w)` clockwise from the top pointer at rotation 0.[^logic]
- The canvas draws marquee bulbs that chase while spinning, pegs, and labels
  that shrink up to 20 % then truncate with "…".
- `sliceColors` cycles 6 paints so neighbours (incl. last→first) differ.
- Result `<dialog>`: **Work on this** (`confirmPick`) or **Spin again**.

# Swipe

- Cards dealt one at a time in random order (`shuffle`, `drawCard`).
  Right / → / **Work on this** = pick; left / ← / **Skip** = next card.
- A skipped card never comes straight back; when the deck runs out the whole
  wheel reshuffles; projects added mid-round join next round.[^readme]
- Drag: accepted past 35 % of card width, or a flick (> 40 px, > 0.6 px/ms).
- Mode is saved in `spinwheel:mode` and shared by all sections.

# Tickets (Working on & done)

- Picked projects move to the top of the pile with `pickedAt`.
- Checkbox toggles `done` (struck through with a punched hole); **Back to
  wheel** returns it to the end of the wheel.
- New tickets get the `arrive` animation (`arrivingId`).

[^readme]: README
[^logic]: logic.js
