# project-spinwheel

A spinning wheel of your projects. Add projects, spin, and the wheel picks
what you work on next. When you confirm a pick it leaves the wheel and becomes
a ticket in **Working on & done**, where you can tick it off or put it back.

Everything is saved in your browser (localStorage). It stays on that browser
and device, and clearing the site's data wipes it.

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
- on macOS, run them with the built-in JavaScriptCore:

  ```sh
  /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests.js
  ```

## Files

| File | What it does |
|---|---|
| `index.html` | Page markup |
| `style.css` | Look and layout |
| `app.js` | Wheel drawing, spin animation, buttons, saving |
| `logic.js` | Pure state and spin maths, no DOM |
| `tests.js`, `tests.html` | Tests for `logic.js` |
