# Project Spinwheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, no-build project-picker wheel with a ticket pile, persisted in localStorage, served by GitHub Pages.

**Architecture:** `logic.js` is a pure ES module (state transitions, storage, spin geometry) with no DOM access. `app.js` owns DOM, canvas drawing and animation and calls into `logic.js`. `tests.html` imports `logic.js` and runs assertions in the browser.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Canvas 2D, `<dialog>`, localStorage. Font: Bricolage Grotesque via Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-21-spinwheel-design.md`

## Global Constraints

- No package.json, no dependencies, no build step. Files at repo root.
- localStorage key: `spinwheel:v1`; shape `{ wheel: [{id, name}], pile: [{id, name, done, pickedAt}] }`.
- Names: trimmed, max 60 chars; case-insensitive duplicates on the wheel rejected.
- Spin: 5–8 full turns, ~4.5 s ease-out; ~0.6 s under `prefers-reduced-motion`; stop offset within 15–85% of the slice width; randomness from `crypto.getRandomValues`.
- Palette, type and layout exactly as in the spec's "Visual direction".
- Sentence case copy, no all-caps labels.
- No JS runtime on the dev machine: tests run by opening `tests.html` in the browser; it sets `document.title` to `PASS <n>` or `FAIL <n>`.

## Review Focus

1. Corrupt / non-JSON / wrong-shape localStorage → starts empty, no crash (test in Task 1).
2. Storage that throws (Safari private mode, quota) → app keeps working in memory (test in Task 1).
3. "Garden shed" vs " garden SHED " → second rejected as duplicate (test in Task 1).
4. Spin clicked repeatedly or Escape on the result dialog → never double-picks; Escape behaves like "Spin again" (manual check in Task 3).
5. Odd slice counts (1, 3, 7) → adjacent colors never repeat including last→first wrap (n=1 exempt) (test in Task 2).

---

### Task 1: State and storage (`logic.js` + `tests.html`)

**Files:**
- Create: `logic.js`, `tests.html`

**Interfaces:**
- Produces (all pure, return new state objects, never mutate input):
  - `emptyState() -> State`
  - `addProject(state, name: string) -> { state, error: null | 'empty' | 'duplicate' }`
  - `removeProject(state, id: string) -> State`
  - `confirmPick(state, id: string, now: number) -> State` — wheel item → front of pile, `done:false`, `pickedAt: now`
  - `toggleDone(state, id: string) -> State`
  - `returnToWheel(state, id: string) -> State` — pile item → end of wheel (no duplicate check)
  - `loadState(storage) -> State` — `storage` has `getItem`; any failure → `emptyState()`; drops malformed entries
  - `saveState(storage, state) -> boolean` — false if `setItem` throws
  - `STORAGE_KEY = 'spinwheel:v1'`

- [ ] **Step 1: Write `tests.html`** with a ~20-line `test(name, fn)` / `assertEqual` harness that lists results and sets `document.title`. Tests:
  - `addProject trims and adds` — `addProject(emptyState(), '  Garden shed ')` → wheel names `['Garden shed']`, error null
  - `addProject rejects empty` — `'   '` → error `'empty'`, wheel length 0
  - `addProject rejects case-insensitive duplicate` — add `'Garden shed'` then `' garden SHED '` → error `'duplicate'`, length 1
  - `addProject truncates to 60` — 80× `'a'` → name length 60
  - `removeProject removes by id`
  - `confirmPick moves to front of pile` — two picks, newest first, `done:false`, `pickedAt` set, wheel shrinks
  - `toggleDone flips done`
  - `returnToWheel moves pile item to end of wheel`
  - `functions do not mutate input` — deep-equal the input before/after `addProject`/`confirmPick`
  - `loadState round-trips saveState` — fake storage object `{data:{}, getItem, setItem}`
  - `loadState handles garbage` — `'not json'`, `'null'`, `'{"wheel":5}'`, `'{"wheel":[{"name":3}]}'` → `emptyState()` shaped result, malformed entries dropped
  - `loadState handles throwing storage` — `getItem` throws → `emptyState()`
  - `saveState returns false on throw`
- [ ] **Step 2: Open `tests.html` in the browser; expect `FAIL` (module missing).**
- [ ] **Step 3: Implement the Task 1 interfaces in `logic.js`.** Ids via `crypto.randomUUID()`.
- [ ] **Step 4: Reload `tests.html`; expect `PASS 13`.**
- [ ] **Step 5: Commit** `feat: add state and storage logic with browser tests`

### Task 2: Spin geometry and slice colours (`logic.js`)

**Files:**
- Modify: `logic.js`, `tests.html`

**Interfaces:**
- Geometry convention: slice `i` spans `[i·w, (i+1)·w)` radians clockwise from the pointer (top) at rotation 0, `w = 2π/n`. Rotating the wheel clockwise by `r` puts wheel-angle `(-r mod 2π)` under the pointer.
- Produces:
  - `pickIndex(n: number, rand: () => number) -> number` — `floor(rand()·n)`, clamped to `n-1`
  - `indexAtPointer(rotation: number, n: number) -> number`
  - `targetRotation(current: number, index: number, n: number, rand: () => number) -> number` — returns `r > current` with `turns ∈ {5,6,7,8}` from `rand`, offset `0.15 + 0.7·rand()` of the slice, such that `indexAtPointer(r, n) === index`
  - `sliceColors(n: number, paletteSize: number) -> number[]` — palette indices; `i % paletteSize`, except if `n>1` and last equals first, bump last to the next index that differs from both neighbours
  - `easeOutCubic(t: number) -> number`

- [ ] **Step 1: Add tests:**
  - `pickIndex stays in range` — `rand=()=>0` → 0; `rand=()=>0.999999` with n=5 → 4
  - `targetRotation lands on requested slice` — for n in `[1,2,3,7,12]`, every index, rand values `[0, 0.5, 0.9999]`, starting current `[0, 1.3, 40]` → `indexAtPointer(r,n) === index` and `r - current >= 5·2π - 2π` and `r > current`
  - `targetRotation keeps off borders` — fractional position inside slice ∈ [0.15, 0.85]
  - `sliceColors no adjacent repeats` — for n 1..20, paletteSize 6: `c[i] !== c[i+1]` and (n>1) `c[n-1] !== c[0]`
  - `easeOutCubic endpoints` — 0→0, 1→1
- [ ] **Step 2: Reload `tests.html`; expect `FAIL`.**
- [ ] **Step 3: Implement.** `targetRotation`: `a = (index + offset)·w`; `delta = ((-a - current) mod 2π + 2π) mod 2π`; `r = current + delta + turns·2π`.
- [ ] **Step 4: Reload; expect `PASS 18`.**
- [ ] **Step 5: Commit** `feat: add spin geometry and slice colours`

### Task 3: UI (`index.html`, `style.css`, `app.js`, `README.md`)

**Files:**
- Create: `index.html`, `style.css`, `app.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything from Tasks 1–2.

- [ ] **Step 1: `index.html`** — header title "Project spinwheel"; `<main>` with wheel section (`<canvas>`, pointer element, hub `<button id="spin">Spin</button>`, empty-state message) and side column (add `<form>` with labelled input + "Add" button + inline error `role="status"`, "On the wheel" list with count, "Working on & done" ticket list); `<dialog id="result">` with name heading, "Work on this" and "Spin again" buttons. Load font, `style.css`, `<script type="module" src="app.js">`.
- [ ] **Step 2: `style.css`** — tokens from the spec as CSS custom properties; two-column grid ≥ 860px, stacked below; wheel size `min(78vh, 46vw)` desktop / `min(92vw, 520px)` phone; tickets with notched ends (radial-gradient mask) on Ticket paper, done = struck through + punched hole; Bulb focus ring on every control; `prefers-reduced-motion` disables CSS transitions.
- [ ] **Step 3: `app.js`** — load state, render lists, draw wheel on canvas (HiDPI-scaled, labels radial, ellipsised to fit, redraw after `document.fonts.ready` and on resize), `rand()` from `crypto.getRandomValues`, spin via `requestAnimationFrame` with `easeOutCubic`, lock spin while animating or dialog open, open dialog on stop; "Work on this" → `confirmPick`; "Spin again" / Escape (`cancel` event) → close, leave item; save after every change.
- [ ] **Step 4: `README.md`** — what it is, Pages setup (Settings → Pages → Deploy from branch → `main` / root), how to run tests (open `tests.html`), note that data is per browser.
- [ ] **Step 5: Verify in browser** — add 7 projects incl. a 60-char one, spin, confirm, tick done, back to wheel, remove, reload (state persists), duplicate rejected, Escape on dialog keeps item, rapid Spin clicks spin once, keyboard-only flow works, phone width 375px, reduced-motion emulation. Screenshot desktop + phone and critique against spec principles; fix.
- [ ] **Step 6: Commit** `feat: add wheel UI` and `docs: readme with Pages setup`
