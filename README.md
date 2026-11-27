# project-spinwheel

A spinning wheel of your projects. Add projects, spin, and the wheel picks
what you work on next. When you confirm a pick it leaves the wheel and becomes
a ticket in **Working on & done**, where you can tick it off or put it back.

Everything is saved in your browser (localStorage). It stays on that browser
and device, and clearing the site's data wipes it.

## Spin or swipe

The switch above the wheel picks how you choose:

- **Spin** spins the wheel, as above.
- **Swipe** deals your projects one card at a time in random order. Swipe
  right (or press →, or **Work on this**) and it becomes a ticket, same as
  confirming a spin. Swipe left (or press ←, or **Skip**) and the next card
  comes up. Once you've skipped every card the deck reshuffles and keeps
  going, and the card you just skipped never comes straight back. Projects
  you add mid-round join at the next shuffle.

The app remembers which mode you used last.

## Backup and import

Under **Backup & import**:

- **Export** downloads `spinwheel-YYYY-MM-DD.json` with everything: the wheel,
  the tickets, whether they're done and when they were picked. Use it as a
  backup or to move to another browser or device.
- **Import…** takes one of two kinds of file:
  - **A backup (`.json`).** If the app is empty it loads straight away.
    Otherwise it asks:
    - **Merge** keeps what you have and adds what's new. It skips anything
      that's already here (same project from an earlier export, or a name
      already on the wheel).
    - **Replace** swaps everything for what's in the file.
  - **A list of names (`.txt` or `.csv`).** Each line becomes a project on the
    wheel, with the same rules as typing it in: trimmed, at most 60 characters,
    no duplicates.
    - A `.txt` uses the whole line, commas included.
    - A `.csv` uses the first column. Comma, semicolon and tab delimiters and
      quoted values all work, and a header row named `Name`, `Project` or
      `Projekt` is skipped.

## Use it as a Chrome extension

The same files are also a Chrome extension (Chrome 116 or newer) that opens
in the side panel, so the wheel can stay next to whatever you're working on.

1. Get the repo onto the computer where Chrome runs (clone it or download the
   ZIP and unpack it).
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and pick the repo folder (the one with
   `manifest.json`).
4. Pin **Project spinwheel** from the puzzle-piece menu. Clicking its icon
   opens the side panel.

**Open in full tab** at the top of the panel opens the big wheel in a tab.
The panel and the tab share the same data and stay in step.

After pulling changes, click the reload arrow on the extension's card in
`chrome://extensions`.

The extension keeps its own data, separate from the website. To bring your
projects over, use **Export** on the website and **Import…** in the extension.
Removing the extension deletes its data, so export first.

## Use it on GitHub Pages

No build step. The site is the files at the repo root.

1. Push to `main`.
2. In the repo on GitHub: **Settings → Pages → Build and deployment →
   Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
3. After a minute it's live at `https://<user>.github.io/project-spinwheel/`.

## Run it locally

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Tests

The logic in `logic.js` (list changes, storage, spin maths, swipe deck) has tests in
`tests.js`. Either:

- open `http://localhost:8000/tests.html`, where the page title shows `PASS <n>`, or
- with Node:

  ```sh
  node --input-type=module -e "globalThis.print = console.log; await import('./tests.js')"
  ```

- on macOS, run them with the built-in JavaScriptCore:

  ```sh
  /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests.js
  ```

## Files

| File | What it does |
|---|---|
| `index.html` | Page markup |
| `style.css` | Look and layout |
| `app.js` | Wheel drawing, spin animation, swipe deck, buttons, saving, export and import |
| `logic.js` | Pure state, spin maths, swipe-deck shuffling and backup/name-list parsing, no DOM |
| `tests.js`, `tests.html` | Tests for `logic.js` |
| `manifest.json` | Chrome extension manifest (side panel) |
| `background.js` | Extension service worker: the toolbar icon opens the side panel |
| `icons/` | Wheel icon as SVG, plus the PNG sizes the extension needs |
| `fonts/` | Bundled Bricolage Grotesque and its license (`OFL.txt`) |
| `knowledge/` | Notes for developers and AI sessions: architecture, decisions, workflows, history ([OKF v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf)). Start at `knowledge/index.md` |
| `CLAUDE.md` | Tells Claude Code sessions to read and update `knowledge/` |
