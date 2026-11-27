---
type: Design Guide
title: Visual design
description: The "ticket booth at dusk" look - colours, type, layout breakpoints and motion rules for the spinwheel UI.
tags: [design, css]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: design, resource: ../../docs/superpowers/specs/2026-11-21-spinwheel-design.md, title: Original design spec }
  - { id: css, resource: ../../style.css, title: style.css }
---

# Concept

A fairground prize wheel; a pick hands you a **ticket**, finished tickets get
punched. The wheel is the one bold thing; everything else is quiet.[^design]

# Colours (CSS variables)

| Var | Hex | Use |
|---|---|---|
| `--dusk` | #1F1A3D | Page background |
| `--booth` / `--booth-raised` | #2C2557 / #362E68 | Panels, inputs, pills |
| `--bulb` | #FFD166 | Pointer, focus ring, primary buttons, active section |
| `--ticket` | #F3E9D2 | Tickets, cards, dialogs |
| `--ink` | #231C48 | Text on ticket and bulb |
| `--haze` | #C9C3EE | Secondary text |

Slice paints: #EF5B3E, #F2A541, #2FA59A, #4E86E4, #B76AD4, #7FBF5A.

# Type

One family, Bricolage Grotesque (bundled variable font, OFL). Headlines heavy
and condensed (`font-stretch` ~78–85 %). Steps 1 / 1.25 / 1.6 / 2.4 / 3.6 rem.

# Layout breakpoints

| Width | Layout |
|---|---|
| < 860 px | One column: sections strip, stage, side column |
| 860–1099 px | Sections strip across the top; wheel left, side column right |
| ≥ 1100 px | Three columns: sections, wheel, side. Max width 96 rem |

# Rules

- Motion only answers the user (spin, dialog pop, ticket arrive, card deal).
  `prefers-reduced-motion` turns animations off.
- Dialogs and tickets use a notched mask (`--notches`), so focus rings inside them use `--ink`.
- Responsive down to 360 px; visible focus everywhere; AA contrast.

[^design]: Original design spec
