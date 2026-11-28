---
type: Playbook
title: Headless browser checks
description: Driving the spinwheel in user-local headless Chromium (Playwright) for UI checks and screenshots, and the traps already hit.
tags: [workflow, testing, playwright]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: hc-readme, resource: ~/.local/share/headless-chromium/README.md, title: Headless Chromium setup notes }
  - { id: session, resource: "session project-spinwheel-5 (2026-11-27)", title: Sections session }
---

# Setup

A user-local `chrome-headless-shell` + `playwright-core` exists. Always run
scripts through the wrapper, or Chromium fails on missing `libnspr4.so`:[^hc-readme]

```sh
headless-chromium-env node /tmp/check.mjs
```

```js
import { createRequire } from 'module';
import { homedir } from 'os';
const { chromium } = createRequire(`${homedir()}/.local/share/headless-chromium/`)('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.HEADLESS_CHROMIUM_EXE });
```

Keep scripts and screenshots in `/tmp`, then read the PNGs to look at them.

# Examples

- Seed data before load: `page.addInitScript(() => localStorage.setItem('spinwheel:v2', …))`.
- Test migration by seeding `spinwheel:v1` instead.
- Export: `Promise.all([page.waitForEvent('download'), page.click('#export')])`
  with `acceptDownloads: true` on the context.
- Import: `page.setInputFiles('#import-file', path)`.
- Wait for a spin: `page.waitForSelector('#result[open]', { timeout: 8000 })`.
- Check widths 1440, 960, 400 and 360 (side panel).

# Traps already hit[^session]

- `.section-pick >> text=Work` also matches "working" in another pill's meta
  line. Use `.section-pick:has(.section-name:text-is("Work"))`.
- Dialog `close` handlers run async; reading the DOM right after clicking a
  dialog button can see the old state. Wait for the change first.
- Screenshots right after `showModal()` catch the pop-in animation half way.

[^hc-readme]: Headless Chromium setup notes
[^session]: Sections session
