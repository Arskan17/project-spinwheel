---
type: Feature
title: Chrome extension
description: The same files load as a Manifest V3 Chrome extension that opens the spinwheel in the side panel.
tags: [feature, chrome, extension]
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-27T12:35:00Z }
sources:
  - { id: manifest, resource: ../../manifest.json, title: manifest.json }
  - { id: readme, resource: ../../README.md, title: README }
---

# How it works

- `manifest.json`: MV3, Chrome 116+, `side_panel.default_path: index.html`,
  permission `sidePanel` only.[^manifest]
- `background.js`: clicking the toolbar icon opens the side panel
  (`setPanelBehavior({ openPanelOnActionClick: true })`). The website never loads it.
- In the panel (`chrome-extension:` protocol, no `?view=tab`) an **Open in
  full tab ↗** link appears; the tab opens `index.html?view=tab`.
- Panel and tab share localStorage and stay in step via the `storage` event.

# Install (owner's steps)

`chrome://extensions` → Developer mode → **Load unpacked** → pick the repo
folder → pin it. After pulling changes, click reload on the extension card.[^readme]

# Gotchas

- Extension data is separate from the website and is deleted with the
  extension: export first.
- The side panel is narrow (~360–400 px), so test layouts at that width.
- Unpacked extensions get an ID from their folder path unless the manifest
  has a `key`, which matters for [Chrome sync](/features/chrome-sync.md).

[^manifest]: manifest.json
[^readme]: README
