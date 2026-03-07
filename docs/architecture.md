# Architecture

TabMD is a local-only Chrome MV3 extension. It uses the `wxt` framework to bundle entrypoints into extension pages.

## Entrypoints

1. **New Tab Page** (`entrypoints/newtab/index.ts`)
   The core surface. Overrides Chrome's New Tab page. Instantiates an EasyMDE editor instance and handles interactions like previewing, title overrides, and note saving. Navigates by reading UUIDs from the URL hash.

2. **Popup** (`entrypoints/popup/index.ts`)
   Provides a quick dropdown listing the 20 most recently modified notes. Reads them completely in-memory upon popup click, but keeps only a bounded top-20 list instead of sorting the full collection. Can't write or delete notes — defers editing and deleting actions to dedicated pages.

3. **Full List Page** (`entrypoints/list/index.ts`)
   An unlisted page designated for browsing all saved notes. Builds a normalized search index once per load so each query only performs containment checks and snippet extraction over the cached note set. Displays UI cards with snippets.

4. **Options Page** (`entrypoints/options/settings_page.ts`)
   Handles visual theme preference (OS, Light, Dark mode).

## Data and Persistence

See `storage.md` for a deeper dive into the Chrome storage limits and implementation. All persistence runs through `chrome.storage.local`.

## Interaction Logic

No real-time DOM synchronization across multiple tabs viewing the same note ID. It relies on a "Last Save Wins" heuristic, firing a write event whenever `visibilitychange` evaluates to `hidden` or `beforeunload` is fired. The save path skips writes when neither the editor content nor the manual title changed since the last successful persistence call.
