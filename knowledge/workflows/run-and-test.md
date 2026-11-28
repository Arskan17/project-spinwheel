---
type: Playbook
title: Run and test
description: How to serve the spinwheel on the headless dev server so the owner can open it, and how to run the logic tests.
tags: [workflow, testing, dev-server]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T14:25:00Z }
sources:
  - { id: readme, resource: ../../README.md, title: README }
  - { id: claude-md, resource: ~/.claude/CLAUDE.md, title: Owner's machine notes }
---

# Machine

Headless Debian server, reached by the owner over Tailscale SSH. No GUI, and
the owner **can't open localhost**.[^claude-md]

# Serve for the owner

1. Check the port is free: `ss -ltn | grep :8765` (old servers often hold 8000).
2. From the repo/worktree root: `python3 -m http.server 8765 --bind 0.0.0.0`
   (run in the background).
3. Give the owner `http://<tailscale ip>:8765`; get the IP with `tailscale ip -4`.
   Don't write the IP or hostname into the repo: it's public via GitHub Pages.
4. Stop the server once the review or merge is done.

# Tests

```sh
node --input-type=module -e "globalThis.print = console.log; await import('./tests.js')"
```

Last line is `PASS <n>` or `FAIL <n>` (45 tests as of 2026-11-27). The
harness is hand-rolled in `tests.js` (`test`, `assertEqual`, `assert`,
`fakeStorage`); add new tests above `// ---- report ----`.
`tests.html` runs the same file in a browser. Only `logic.js` is unit
tested; check `app.js` with [headless browser checks](/workflows/browser-checks.md).

Quick syntax check of the page code: `node --check app.js`.

[^claude-md]: Owner's machine notes
