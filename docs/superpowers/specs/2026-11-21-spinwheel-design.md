# Project Spinwheel — design

Date: 2026-11-21 · Status: approved by owner in conversation

## Intent

A personal "what do I work on next?" picker. The owner keeps a list of
projects; each one is a slice on a wheel. Spinning picks one at random;
confirming the pick moves it off the wheel into a "working on / done" pile.
State lives in the browser. Hosted on GitHub Pages from this repo.

The owner wants it working **with the least fuss** — that drives every
technical choice below.

## Goals

- Add / remove projects; the wheel always mirrors the list.
- Spin → fair random pick → "Work on this" or "Spin again".
- Confirmed picks leave the wheel and land in the pile.
- In the pile: tick as done (struck through), or put back on the wheel.
- Survives reloads (localStorage).
- Served as static files from `main` / repo root on GitHub Pages.

## Non-goals

Sync across devices, accounts, export/import (possible later), sharing.

## Anti-goals

- A build step, toolchain, or dependency to keep alive.
- A biased or "rigged-feeling" spin (landing on slice borders, same slice
  repeatedly due to bad randomness).

## Approaches considered

| Approach | Trade-off | Verdict |
|---|---|---|
| Plain HTML/CSS/JS, no build | Fewest moving parts; Pages serves it as-is | **Chosen** |
| Framework + bundler (Vite/Svelte) | Nicer component model; adds node toolchain + Actions build | Rejected: fuss |
| Rust → WASM (Trunk/wasm-pack) | Fun if learning Rust; toolchain, CI build, ~100s KB payload | Rejected: owner wants least fuss |

## Behaviour

- **Add**: text input + "Add" (Enter works). Trimmed, max 60 chars, empty
  ignored. Case-insensitive duplicate of something already on the wheel is
  rejected with an inline message. *(builder's call)*
- **Remove**: ✕ next to each wheel item.
- **Spin**: the wheel hub is the Spin button. ~4.5 s ease-out spin, 5–8 full
  turns, stops with the pointer (top) inside a uniformly chosen slice, at a
  random offset that keeps clear of slice borders. Uses
  `crypto.getRandomValues`. With `prefers-reduced-motion`, spin lasts ~0.6 s.
  Disabled while spinning and when the wheel is empty.
- **Result dialog** (`<dialog>`): shows the project name large;
  "Work on this" (moves it to the pile) or "Spin again".
- **Pile** ("Working on & done"): newest first. Each entry: checkbox to mark
  done (struck through, stamped look), "Back to wheel" button.
- **Empty wheel**: wheel area shows an invitation to add projects.
- **One project**: still spins (full-circle slice).
- **Persistence**: single localStorage key `spinwheel:v1` holding
  `{ wheel: [{id, name}], pile: [{id, name, done, pickedAt}] }`. Corrupt or
  missing data → start empty, never crash.

## Visual direction (frontend-design pass)

**Subject & job.** A personal fairground prize wheel for one's own projects.
Primary job: make choosing feel decisive and a little fun. Audience: the
owner, desktop and phone.

**Concept: "the ticket booth at dusk."** The wheel is a painted fairground
wheel; winning a spin hands you a *ticket* — the pile is your stack of
tickets, and marking one done punches it. The metaphor gives the pile a
reason to look different from the list without decorative cards.

**Color**

| Name | Hex | Role |
|---|---|---|
| Dusk | `#1F1A3D` | page background |
| Booth | `#2C2557` | panels, input fields |
| Bulb | `#FFD166` | pointer, focus ring, primary button |
| Ticket | `#F3E9D2` | ticket paper (pile only) |
| Ink | `#231C48` | text on ticket/bulb |
| Haze | `#C9C3EE` | secondary text on dusk |

Slice paints (cycled): `#EF5B3E` tomato, `#F2A541` marigold, `#2FA59A`
teal, `#4E86E4` sky, `#B76AD4` orchid, `#7FBF5A` grass. Adjacent slices
never repeat; with an odd count the last slice skips the first's color.

**Type.** One family: *Bricolage Grotesque* (Google Fonts, variable). Title
and winner name at heavy weight and condensed width, as the loud element;
body at 400/500. Fallback: system-ui. Scale: 1rem body, 1.25 / 1.6 / 2.4 /
3.6rem steps. Sentence case everywhere; no all-caps labels.

**Layout.** Desktop: wheel on the left, as large as the viewport allows
(`min(78vh, 46vw)`), pointer on top, hub = Spin. Right column (max ~28rem):
add form, "On the wheel" list, ticket pile. Phone: wheel first (full width),
then the column. Text left-aligned.

```
┌─────────────────────────────────────────────────────────┐
│ Project spinwheel                                       │
│                    ▼                ┌─────────────────┐ │
│              ╭──────────╮           │ [add project…][+]│ │
│            ╱  ╲ tomato ╱ ╲          │ On the wheel · 5 │ │
│           │ teal (SPIN) sky│        │  Garden shed   ✕ │ │
│            ╲  ╱marigold╲ ╱          │  …               │ │
│              ╰──────────╯           │ Working on & done│ │
│                                     │ ▭ Blog redesign  │ │
│                                     │ ▭ Tax return ✓   │ │
│                                     └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Principles**

1. The wheel is the one bold thing. Everything else is quiet.
2. Motion only answers the user: the spin, the dialog opening, a ticket
   arriving in the pile. No entrance animations.
3. Tickets are the only non-dusk surface — they mark "picked".
4. Quality floor: responsive to 360px, visible focus (Bulb ring), reduced
   motion respected, AA contrast.

**Review against the brief.** First draft was "near-black page, neon
rainbow wheel, Inter, rounded cards for lists" — the generic spinner-app
default (trait 2 + trait 4). Revised: deep violet dusk instead of near-black,
a fairground paint palette rather than neon, one characterful grotesque
instead of Inter, and tickets instead of identical cards, so the pile reads
as a different kind of object from the wheel list.

## Files

```
index.html   markup
style.css    styles
logic.js     pure state + spin math (ES module, no DOM)
app.js       DOM, canvas, animation, storage wiring (ES module)
tests.html   in-browser test runner for logic.js
```

No package.json, no dependencies. Tests run by opening `tests.html`
(no JS runtime is installed on the dev machine).

## Left to the builder

Exact copy, spacing, canvas label truncation, shadow/texture details,
dialog styling — within the principles above.
