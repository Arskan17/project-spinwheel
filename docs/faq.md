# FAQ

Questions about the Chrome extension and syncing. For setup, see the
[README](../README.md#use-it-as-a-chrome-extension).

## Sync

### Do I log into the extension?

No. The extension has no account. It uses Chrome's own sync, so you sign into
**Chrome** with your Google account and turn sync on. Under **Settings → You
and Google → Sync and Google services → Manage what you sync**, keep
**Extensions** ticked.

### What happens if I'm not signed in, or sync is off?

Everything still saves, just on that computer. If you turn sync on later,
Chrome uploads what's there and merges it with your other computers.

### Do I need to install it on every computer?

Yes, once. Chrome only installs Web Store extensions on your other computers
automatically, not unpacked ones. Load it unpacked on each one; after that the
projects come across by themselves.

### Why does the manifest have a `"key"`?

Chrome syncs an extension's data by its ID. For an unpacked extension the ID
normally depends on the folder it's in, so two computers would get different
IDs and never share data. The key fixes the ID to
`eenecdadhengejemgbbkajeogdehcfbo` wherever you load it from.

### I used the extension before sync was added. Is my data kept?

Only if the extension already had the ID above. On first start with sync it
copies anything it saved before into sync, once, and merges it with what's
already there. Skipping duplicates works the same as **Merge** on import.

The version before sync didn't have a fixed ID, so Chrome treats the new one
as a different extension and can't see the old data. To bring it across:

1. In the old version, click **Export** before you update.
2. Update the folder and reload the extension in `chrome://extensions`.
3. Click **Import…** and pick the file.

### What if I change something on two computers at once?

Changes to different projects merge. If both computers change the same
project while one is offline, the last change saved wins for that project.

### Is there a limit?

Chrome sync holds about 100 KB per extension. The app allows up to 500
projects (wheel and tickets together), fewer if names are long and use
characters outside the Latin alphabet. If a change doesn't fit, the app says
**Not saved** and shows what is actually stored. Export a backup and remove
old tickets to make room.

Chrome also limits how often an extension can write (about 120 changes a
minute). You'd have to click very fast to hit it, and if you do, the app
warns you and you can try again a moment later.

### Is the Spin/Swipe choice synced?

No. Which mode you used last is remembered per computer.

### Does the website sync too?

No. The GitHub Pages site saves in that browser only. Use **Export** and
**Import…** to move data between the site and the extension.

## Other browsers

### Does it work in Brave, Edge, Vivaldi or Opera?

They run Chrome extensions, so it should load with **Load unpacked** the same
way (in Brave: `brave://extensions`, in Edge: `edge://extensions`). Two
things are untested there:

- **Side panel.** It needs Chrome's side panel API. If clicking the icon does
  nothing in your browser, that browser doesn't support it. Open
  `chrome-extension://eenecdadhengejemgbbkajeogdehcfbo/index.html?view=tab`
  in a tab instead (Edge uses the same address).
- **Sync.** Only Chrome syncs through your Google account. Brave has its own
  Brave Sync with no Google account, and it isn't documented whether it
  syncs extension data. Edge syncs through your Microsoft account. Either
  way, sync only works within one browser: Chrome and Brave never share data.

Without sync, everything still saves on that computer, and **Export** /
**Import…** move data between browsers.

### Can I sync between Chrome and Brave?

Not automatically. Export in one and import in the other. **Merge** keeps
what's there and adds only what's new.
