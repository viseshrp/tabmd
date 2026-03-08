# Architecture

TabMD is a local-first Chrome MV3 extension. It uses the `wxt` framework to bundle entrypoints into extension pages, and it exposes an optional manual Google Drive backup flow from the options page.

## Entrypoints

1. **New Tab Page** (`entrypoints/newtab/index.ts`)
   The core surface. Overrides Chrome's New Tab page. Instantiates an EasyMDE editor instance, routes the Preview tab through EasyMDE's native preview mode, and handles title overrides plus note saving. Navigates by reading UUIDs from the URL hash.

2. **Popup** (`entrypoints/popup/index.ts`)
   Provides a quick dropdown listing a bounded set of the most recently modified notes. Reads them completely in-memory upon popup click, but keeps only a small configured top-N list instead of sorting the full collection. Can't write or delete notes — defers editing and deleting actions to dedicated pages. The built extension serves this entrypoint as `popup.html`.

3. **Full List Page** (`entrypoints/list/index.ts`)
   An unlisted page designated for browsing all saved notes. Builds a normalized search index once per load so each query only performs containment checks and snippet extraction over the cached note set. Displays UI cards with snippets. The built extension serves this entrypoint as `list.html`, which is the URL popup navigation must open.

4. **Options Page** (`entrypoints/options/settings_page.ts`)
   Handles visual theme preference (OS, Light, Dark mode) plus optional Google Drive connect/backup/restore actions. The restore list is loaded lazily into a dialog so the page avoids Drive network work until the user explicitly asks for backup history.

5. **Drive Backup Modules** (`entrypoints/drive/`)
   Wrap `chrome.identity`, call the Google Drive REST API, serialize note snapshots, enforce retention, maintain a local backup-index cache, and restore backups into local storage. Backup files are separated per extension install under `tabmd_backups/<installId>/`.

## Data and Persistence

See `storage.md` for a deeper dive into the Chrome storage limits and implementation. Day-to-day persistence runs through `chrome.storage.local`; manual Drive backups serialize that same state into JSON snapshots stored in the user's Drive account.

## Interaction Logic

Open TabMD surfaces synchronize through `chrome.storage.local`. The new-tab editor writes title and content changes immediately, popup/list surfaces subscribe to `chrome.storage.onChanged`, and all pages still follow a last-write-wins model when two surfaces edit the same note concurrently. The save path skips exact no-op writes and serializes storage updates so overlapping writes do not race each other.
