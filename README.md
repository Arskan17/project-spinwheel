# project-spinwheel

A spinning wheel of your projects. Add projects, spin, and the wheel picks
what you work on next. When you confirm a pick it leaves the wheel and becomes
a ticket in **Working on & done**, where you can tick it off or put it back.

Everything is saved in your browser (localStorage). It stays on that browser
and device, and clearing the site's data wipes it.

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

The logic in `logic.js` (list changes, storage, spin maths) has tests in
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
| `app.js` | Wheel drawing, spin animation, buttons, saving, export and import |
| `logic.js` | Pure state, spin maths and backup/name-list parsing, no DOM |
| `tests.js`, `tests.html` | Tests for `logic.js` |
