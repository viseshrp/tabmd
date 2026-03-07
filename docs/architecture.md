# Architecture

TabMD is a local-first Chrome MV3 extension. It uses the `wxt` framework to bundle entrypoints into extension pages, and it exposes an optional manual Google Drive backup flow from the options page.

## Entrypoints

1. **New Tab Page** (`entrypoints/newtab/index.ts`)
   The core surface. Overrides Chrome's New Tab page. Instantiates an EasyMDE editor instance, routes the Preview tab through EasyMDE's native preview mode, and handles title overrides plus note saving. Navigates by reading UUIDs from the URL hash.

2. **Popup** (`entrypoints/popup/index.ts`)
   Provides a quick dropdown listing the 20 most recently modified notes. Reads them completely in-memory upon popup click, but keeps only a bounded top-20 list instead of sorting the full collection. Can't write or delete notes — defers editing and deleting actions to dedicated pages. The built extension serves this entrypoint as `popup.html`.

3. **Full List Page** (`entrypoints/list/index.ts`)
   An unlisted page designated for browsing all saved notes. Builds a normalized search index once per load so each query only performs containment checks and snippet extraction over the cached note set. Displays UI cards with snippets. The built extension serves this entrypoint as `list.html`, which is the URL popup navigation must open.

4. **Options Page** (`entrypoints/options/settings_page.ts`)
   Handles visual theme preference (OS, Light, Dark mode) plus optional Google Drive connect/backup/restore actions.

5. **Drive Backup Modules** (`entrypoints/drive/`)
   Wrap `chrome.identity`, call the Google Drive REST API, serialize note/settings snapshots, enforce retention, and restore backups into local storage.

## Data and Persistence

See `storage.md` for a deeper dive into the Chrome storage limits and implementation. Day-to-day persistence runs through `chrome.storage.local`; manual Drive backups serialize that same state into JSON snapshots stored in the user's Drive account.

## Interaction Logic

No real-time DOM synchronization across multiple tabs viewing the same note ID. It relies on a "Last Save Wins" heuristic, firing a write event whenever `visibilitychange` evaluates to `hidden` or `beforeunload` is fired. The save path skips writes when neither the editor content nor the manual title changed since the last successful persistence call.
