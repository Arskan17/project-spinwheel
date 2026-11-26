// Chrome extension service worker: clicking the toolbar icon opens the
// spinwheel in the side panel. The website build never loads this file.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
