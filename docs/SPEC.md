# SPEC.md — TabMD Product & UX Specification

## 1. Product Overview

TabMD is a Chrome extension that replaces the default new tab page with a Markdown note editor. Each new tab opens a brand-new note. Notes are stored locally in `chrome.storage.local` by default, with an optional manual Google Drive backup/restore flow available from the options page.

The editor experience is powered by EasyMDE. The product should feel lightweight, minimal, and writing-focused — not like a developer IDE.

**Inspiration:** [tab-notes](https://github.com/telemaciek/tab-notes) — unique note per tab via URL hash, popup access to saved notes, local-only storage, first-line title fallback. TabMD differs by adding a full Markdown writing experience with EasyMDE, GFM preview, syntax highlighting, and a dedicated full list management page.

---

## 2. Goals

1. Replace Chrome's new tab page with a distraction-free Markdown editor.
2. One note per tab, identified by a unique ID embedded in the URL hash.
3. Provide a complete GFM-compatible preview (tables, task lists, fenced code blocks with syntax highlighting).
4. Make note management fast: popup for quick access, full list page for searching, renaming, and deleting.
5. Keep all primary note-taking flows local-first, using `chrome.storage.local` with `unlimitedStorage`.
6. Support light/dark theming with OS-default detection and manual override.
7. Allow users to create and restore manual Google Drive backups without turning TabMD into a sync product.

---

## 3. Non-Goals

- Note import from external sources.
- Cloud sync, accounts, or collaboration.
- Side-by-side editor/preview or resizable panes.
- Outline/navigation panels.
- Tags, folders, or hierarchical organization.
- Bulk export or export of all notes at once.
- Mobile app concepts or browser sync.
- Plugin ecosystem or extensibility API.
- Advanced Markdown features beyond agreed GFM scope.

---

## 4. User Experience Principles

1. **Writing-first.** The editor occupies the full page. Chrome and controls fade into the background.
2. **Instant.** A new tab must feel as fast as Chrome's default. No loading spinners, no splash screens.
3. **Minimal.** Every visible element must serve the writing or note-management workflow. No decorative chrome.
4. **Predictable.** Notes save automatically on blur. Titles derive automatically. The user never thinks about persistence.
5. **Local-first.** Data stays in the browser unless the user explicitly runs a manual Google Drive backup or restore action.

---

## 5. Primary User Flows

### 5.1 Create a New Note

1. User opens a new tab (Ctrl+T / Cmd+T).
2. The extension new tab page loads.
3. A new note ID is generated and placed in the URL hash (e.g., `newtab.html#abc123`).
4. The EasyMDE editor renders with autofocus and the placeholder "Start writing…".
5. The user types. The placeholder disappears on first input.
6. When the user navigates away or the tab loses focus, the note is saved.

### 5.2 Resume an Existing Note

1. User clicks a note card in the popup, full list page, or any other link containing the note's hash.
2. A new tab opens with `newtab.html#<noteId>`.
3. The editor loads the saved content for that note ID.
4. The user edits. Note saves on blur.

### 5.3 Preview a Note

1. On the editor page, the user clicks the "Preview" tab (center-top).
2. EasyMDE switches the writing surface into preview mode.
3. The preview renders the current Markdown content with GFM features and syntax-highlighted code blocks.
4. Clicking the "Editor" tab returns to the editor.

### 5.4 Search Notes

1. User opens the full list page (via popup "More" link or direct navigation).
2. Types into the search field.
3. Results filter in real time — matching titles and full note content.
4. Each matching note appears once with its title and one best snippet.
5. Clicking a result opens that note in a new tab.

### 5.5 Delete a Note

1. On the full list page, the user clicks the delete action on a note card.
2. A confirmation dialog appears: "Delete this note? This cannot be undone."
3. Confirming removes the note from storage.
4. Cancelling dismisses the dialog with no effect.

### 5.6 Rename a Note

1. On the full list page, the user clicks the rename action on a note card.
2. An inline rename field or dialog appears, pre-filled with the current title.
3. The user edits the title and confirms.
4. The title is saved as a manual override (see §7.4).

### 5.7 Export Current Note

1. On the editor page, the user clicks an export action.
2. The browser downloads a `.md` file containing the note content.
3. The filename is derived from the note title.

### 5.8 Toggle Focus Mode

1. On the editor page, the user activates focus mode.
2. Focus mode hides the surrounding workspace chrome and expands the editor to fill the viewport.
3. The user exits focus mode via the same toggle or Escape.

### 5.9 Manual Google Drive Backup

1. User opens the options page.
2. Connects Google Drive explicitly.
3. Sets a retention count.
4. Clicks "Backup now".
5. TabMD uploads a JSON snapshot containing all notes and current settings into the user's Drive account.

### 5.10 Restore from Google Drive

1. User opens the options page.
2. Clicks "Restore from backup".
3. TabMD loads one page of backup metadata from Google Drive.
4. User selects a backup row and confirms restore.
5. The selected snapshot overwrites local notes and settings.

---

## 6. Page-by-Page Behavior

### 6.1 New Tab Editor Page

**URL:** `newtab.html#<noteId>`

**Purpose:** The primary writing surface. Every new tab opens this page.

**Layout:**
- **Title area** at the top. Displays the derived or manual title. The editable title field is hidden by default. Clicking the title area reveals the editable field.
- **Tab bar** (center-top) with exactly two tabs: **Editor** | **Preview**. Only one is visible at a time.
- **Editor area** — EasyMDE instance, filling the available space below the tab bar.
- **Preview area** (same position as editor, toggled visibility) — rendered Markdown HTML.
- **Toolbar actions** — Focus mode toggle, export, link to options page.

**Behavior:**
- On load, read the note ID from `location.hash`.
  - If hash is empty: generate a new UUID, set `location.hash`, create a new note record.
  - If hash has an ID: load existing note content from storage.
  - If hash ID is not found in storage: treat as a new note with that ID.
- EasyMDE autofocuses on load.
- Placeholder "Start writing…" shows in empty editor; disappears on first input.
- Note saves when the page/tab loses focus (`visibilitychange` event, `beforeunload` event).
- Title area:
  - If no manual title is set, display the first-line-derived title (see §7.4).
  - If manual title is set, display the manual title.
  - Clicking the title area reveals the editable title input.
  - If the user clears the manual title field and confirms, revert to first-line-derived behavior.
- Preview tab:
  - Preview content renders only when the Preview tab is first clicked (not eagerly).
  - Re-renders each time the Preview tab is clicked.
  - Uses EasyMDE's native preview surface rather than a separate preview container.
  - Supports: GFM tables, task lists, fenced code blocks with syntax highlighting.
- Focus mode keeps the editor visible, hides the surrounding workspace chrome, and leaves the focus toggle available as an exit control.
- Export downloads the current note content as `<title>.md`.
- Options page link opens `options.html` in a new tab.

### 6.2 Popup

**Purpose:** Quick access to recently saved notes and navigation to the full list page and options.

**Layout:**
- A list of saved notes (title only), sorted by most recently modified first.
- A "More" action/link at the bottom.
- An options/settings icon or link.

**Behavior:**
- On open, read all notes from storage and display titles sorted by `modifiedAt` descending.
- Clicking a note title opens `newtab.html#<noteId>` in a new tab.
- No create, rename, or delete actions in the popup.
- "More" opens the full list page in a new tab.
- Options link opens `options.html` in a new tab.
- If no notes exist, show a brief empty state: "No notes yet."

**Constraints:**
- The popup must load fast. Minimal DOM, no heavy rendering.
- Limit displayed notes to a reasonable count (e.g., 20 most recent) to keep the popup snappy. The full list page handles the complete set.

### 6.3 Full List Page

**URL:** `list.html`

**Purpose:** The main note management surface. Search, browse, rename, delete notes.

**Layout:**
- **Header** with page title, note count, search input, "New Note" button, and options link.
- **Search field** — real-time filtering.
- **Note cards** — clickable card-style rows.

**Card contents:**
- Title.
- One best snippet (first non-empty line of content, or a content excerpt).
- Modified date as absolute time (e.g., "Mar 7, 2026, 9:14 AM").
- Quick actions: rename, delete.

**Behavior:**
- On load, read all notes from storage. Sort by `modifiedAt` descending.
- Search:
  - Matches titles and full note content.
  - Real-time filtering as the user types.
  - For a note with multiple matches, show the note once with one best snippet containing a match.
  - If no notes match, show: "No results."
- Clicking a card opens `newtab.html#<noteId>` in a new tab.
- "New Note" button opens a new tab (`newtab.html` with no hash — triggers new note creation).
- Rename:
  - Clicking rename on a card reveals an inline edit field (or modal) pre-filled with the current title.
  - Confirming saves the title as a manual override.
- Delete:
  - Clicking delete shows a confirmation dialog.
  - Confirming removes the note from storage and re-renders the list.
- Options link opens `options.html`.

### 6.4 Options Page

**URL:** `options.html`

**Purpose:** Manage extension settings.

**Layout:**
- **Theme** setting:
  - Three choices: "Use system", "Light", "Dark".
  - Radio buttons, following the existing options page pattern.
- **Google Drive backup** section:
  - Connect/disconnect button.
  - Backup-now button.
  - Restore dialog opener.
  - Retention number input.
  - Restore dialog with backup table and explicit pagination controls.

**Behavior:**
- On load, read current settings from storage and populate controls.
- Changes save immediately (on `change` event, same as existing scaffold pattern).
- Snackbar confirmation on save ("Settings saved.").
- Theme changes apply immediately to the options page itself.
- Drive auth status is checked non-interactively on load.
- Drive backup uploads all notes plus the current settings snapshot.
- Restore replaces local notes and settings with the selected backup payload.
- Reachable from: popup, full list page, new tab editor page.

---

## 7. Exact Behavior Specifications

### 7.1 New Note Creation

- A new note is created when a new tab opens and `location.hash` is empty.
- Generate a UUID v4 as the note ID.
- Set `location.hash` to `#<noteId>` (using `history.replaceState` to avoid a history entry).
- Create a note record in storage with:
  - `id`: the generated UUID.
  - `content`: empty string.
  - `title`: `null` (triggers first-line fallback).
  - `createdAt`: current timestamp.
  - `modifiedAt`: current timestamp.
- The note is saved to storage on first blur — blank notes are persisted.

### 7.2 Opening Existing Notes

- When `location.hash` contains a note ID, load that note's content from storage.
- If the ID is not found in storage, treat it as a new note with that ID (creates the record on first save).
- All note openings (from popup, full list, or direct URL) open in a new tab.

### 7.3 Hash-Based Note Addressing

- The URL hash is the single source of truth for which note is being edited.
- Format: `newtab.html#<noteId>` where `noteId` is a UUID.
- The hash must never contain additional parameters or structure. Just the raw ID.
- On `hashchange` event: reload the editor with the new note. In practice this should not happen during normal use because notes always open in new tabs.

### 7.4 Title Behavior

**Auto-title (first-line fallback):**
- Extract the first line of the note content.
- Strip leading Markdown heading markers (`#`, `##`, etc.) and whitespace.
- If the first line is empty or the note has no content, use "Untitled".
- This derivation happens on every render where `title` is `null`.

**Manual title override:**
- The title area on the editor page is visible but the editable input is hidden by default.
- Clicking the title area reveals the editable title input.
- Typing a manual title and confirming (blur or Enter) sets `title` to the entered string.
- Once a manual title is set, it permanently overrides auto-title.
- Setting `title` to a non-empty string is considered "manual".
- Clearing the title field (setting it to empty string) reverts to auto-title: set `title` back to `null`.

**Rename from full list page:**
- Rename action sets the `title` field in the note record, same as manual title override.

### 7.5 Save-on-Blur

- The note saves when the page loses visibility (`document.visibilitychange` with `document.visibilityState === 'hidden'`).
- Also save on `beforeunload` as a safety net.
- Save writes the current editor content and updated `modifiedAt` to storage.
- If the content has not changed since the last save, skip the write.
- No periodic autosave timer. No save button. No debounced save.

### 7.6 Preview Rendering

- Preview renders only when the Preview tab is clicked — not eagerly, not on every keystroke.
- Preview must render GFM features:
  - Tables.
  - Task lists (checkboxes).
  - Fenced code blocks with language-specified syntax highlighting.
- Use EasyMDE's native preview mode plus `previewRender` hooks to integrate a Markdown renderer and syntax highlighter.

### 7.7 Search Behavior

- Search is available only on the full list page.
- Input field filters notes in real time as the user types.
- Matching is case-insensitive.
- Matches against note title (derived or manual) and full note content.
- Each matching note appears at most once in results.
- Each result shows the note title and one best snippet:
  - If the match is in the title, show the first non-empty line of content as the snippet.
  - If the match is in the content, show the line (or surrounding context) containing the first match.
- Clicking a result opens `newtab.html#<noteId>` in a new tab.
- When the search field is cleared, the full list is restored.

### 7.8 Rename Behavior

- Available on the full list page only.
- Clicking rename on a card reveals an inline input pre-filled with current title.
- Confirming saves the value as a manual title override in the note record.
- Entering an empty string reverts to auto-title (sets `title` to `null`).
- The card immediately re-renders with the new title.

### 7.9 Delete Confirmation

- Delete action is available on the full list page only.
- Clicking delete shows a native `confirm()` dialog: "Delete '<title>'? This cannot be undone."
- If confirmed: remove the note from storage, re-render the list.
- If cancelled: no effect.

### 7.10 Export Current Note

- Available on the editor page only.
- Exports the current note content as a `.md` file.
- Filename: `<sanitized-title>.md` — replace characters unsafe for filenames with hyphens.
- Uses the Blob + anchor download pattern (same as the existing scaffold's JSON export).
- No import feature.

### 7.11 Theme Behavior

- On first install, theme defaults to "os" (follow system `prefers-color-scheme`).
- User can override to "light" or "dark" on the options page.
- Theme is stored in `tabmd:settings` under the `theme` key.
- Theme is applied via `data-theme` attribute on `<html>`, same as the existing scaffold.
- The CSS design token system in `entrypoints/shared/theme.css` handles the visual resolution.
- Theme applies to: new tab page, popup, full list page, options page.

### 7.12 Focus / Fullscreen Mode

- A button/action on the editor page enters focus mode for the visible editor surface.
- Focus mode hides the title card, tabs, export action, and settings action so the editor fills the viewport.
- The focus toggle remains visible as the explicit exit control.
- Escape exits focus mode without relying on timers or delayed layout hacks.

---

## 8. Data Model (Product Level)

### 8.1 Note Record

| Field        | Type             | Description                                                    |
|------------- |------------------|----------------------------------------------------------------|
| `id`         | `string` (UUID)  | Unique identifier. Matches the URL hash.                       |
| `content`    | `string`         | Raw Markdown content of the note.                              |
| `title`      | `string \| null` | Manual title override. `null` means use first-line derivation. |
| `createdAt`  | `number`         | Unix timestamp (ms) of creation.                               |
| `modifiedAt` | `number`         | Unix timestamp (ms) of last modification.                      |

### 8.2 Settings Record

| Field   | Type                        | Description                                       |
|---------|-----------------------------|----------------------------------------------------|
| `theme` | `'os' \| 'light' \| 'dark'` | Theme preference. Default: `'os'`.                |

(The existing `openInNewTab` and `compactCards` settings are scaffold-specific and will be removed.)

### 8.3 Storage Keys

| Key               | Value                        |
|--------------------|------------------------------|
| `tabmd:settings`   | `TabmdSettings` object       |
| `tabmd:notes`      | `Record<string, NoteRecord>` |

Notes are stored as an object keyed by note ID for O(1) lookup.

---

## 9. UI States and Edge Cases

### 9.1 Empty States

| Surface           | Condition           | Display                                              |
|-------------------|----------------------|------------------------------------------------------|
| New tab editor    | Brand-new note       | EasyMDE with "Start writing…" placeholder, autofocus |
| Popup             | No saved notes       | "No notes yet."                                      |
| Full list page    | No saved notes       | Empty state message: "No notes yet. Open a new tab to start writing." |
| Full list search  | No matching results  | "No results."                                        |

### 9.2 Edge Cases

| Scenario                                        | Behavior                                                                                      |
|-------------------------------------------------|-----------------------------------------------------------------------------------------------|
| Hash contains an ID not found in storage        | Treat as a new note with that ID. Create the record on first save.                           |
| User opens same note hash in two tabs           | Both tabs load the same note. Last save wins. No conflict resolution.                        |
| User rapidly opens many new tabs                | Each generates its own UUID. No rate limiting needed.                                        |
| Very large note content                         | `unlimitedStorage` permission handles this. No content size limit enforced by the extension.  |
| Note with only whitespace content               | Auto-title shows "Untitled". Content is preserved as-is.                                     |
| Title field receives only whitespace             | Treated as empty → revert to auto-title (`title` set to `null`).                            |
| Browser crash during editing                    | Data since last blur is lost. Accepted trade-off for simplicity.                             |
| Storage quota exceeded despite unlimitedStorage  | Log error via `logExtensionError`. Show snackbar: "Failed to save. Storage may be full."     |

### 9.3 Error / Fallback Expectations

- All storage reads that fail should fall back to safe defaults (empty notes list, default settings).
- All storage writes that fail should log the error and notify the user via snackbar.
- The extension should never crash — wrap all async init flows in `.catch()` handlers (existing pattern).
- If EasyMDE fails to initialize, show a fallback plain `<textarea>`.

---

## 10. Acceptance Criteria

### 10.1 Core

- [ ] Opening a new tab shows the TabMD editor with autofocus.
- [ ] Each new tab creates a unique note with a UUID in the URL hash.
- [ ] Typing in the editor produces Markdown content.
- [ ] Navigating away from the tab saves the note.
- [ ] Returning to a note (via hash URL) restores its content.

### 10.2 Editor & Preview

- [ ] Center-top tab bar with "Editor" and "Preview" tabs.
- [ ] Only one view (editor or preview) is visible at a time.
- [ ] Preview renders GFM tables.
- [ ] Preview renders task lists with checkboxes.
- [ ] Preview renders fenced code blocks with syntax highlighting.
- [ ] Preview renders only when the Preview tab is clicked.

### 10.3 Title

- [ ] Title area displays first-line-derived title by default.
- [ ] Clicking the title area reveals an editable title input.
- [ ] Setting a manual title overrides the auto-title.
- [ ] Clearing the manual title reverts to auto-title.

### 10.4 Popup

- [ ] Popup lists saved note titles sorted by most recently modified.
- [ ] Clicking a note opens it in a new tab.
- [ ] Popup has a "More" link to the full list page.
- [ ] Popup has a link to the options page.
- [ ] Empty state shows "No notes yet."

### 10.5 Full List Page

- [ ] Lists all notes as clickable cards sorted by most recently modified.
- [ ] Each card shows title, snippet, modified date, rename action, delete action.
- [ ] "New Note" button opens a new tab.
- [ ] Search filters notes in real time by title and content.
- [ ] Each matching note appears once with one best snippet.
- [ ] Rename action allows inline title editing.
- [ ] Delete action requires confirmation before removing the note.
- [ ] Link to options page is present.

### 10.6 Options

- [ ] Theme setting with three options: system, light, dark.
- [ ] Setting changes save immediately.
- [ ] Snackbar confirms save.

### 10.7 Focus Mode

- [ ] Focus mode button expands the visible editor surface to the viewport.
- [ ] The focus toggle remains available while focus mode is active.
- [ ] Escape exits focus mode.

### 10.8 Export

- [ ] Export downloads current note as a `.md` file.
- [ ] Filename is derived from the note title.

### 10.9 Theme

- [ ] First run follows OS theme.
- [ ] Manual override to light or dark works.
- [ ] Theme applies to all extension pages.

### 10.10 Blank Note & Placeholder

- [ ] New blank note shows "Start writing…" placeholder.
- [ ] Placeholder disappears on first input.
