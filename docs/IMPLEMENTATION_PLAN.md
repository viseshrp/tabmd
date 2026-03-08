# IMPLEMENTATION_PLAN.md — TabMD Engineering Plan

> Note: this plan documents the original local-only TabMD build. Optional Google Drive backup was added later and is documented in `README.md`, `docs/storage.md`, `docs/TESTING.md`, and `docs/SPEC.md`.

## 1. Proposed Architecture

TabMD is a WXT-based Chrome MV3 extension. The existing scaffold already provides the WXT build system, Biome linting, Vitest unit/integration tests, Playwright E2E tests, and GitHub Actions CI/CD.

The extension has five runtime surfaces:

| Surface          | WXT Entrypoint Type    | File                         | Description                              |
|------------------|------------------------|------------------------------|------------------------------------------|
| New tab page     | `newtab` override      | `entrypoints/newtab/`        | Markdown editor (EasyMDE)                |
| Popup            | `popup`                | `entrypoints/popup/`         | Quick note list, navigation              |
| Full list page   | Unlisted page          | `entrypoints/list/`          | Note management, search, CRUD            |
| Options page     | `options`              | `entrypoints/options/`       | Theme settings                           |
| Background       | `background`           | `entrypoints/background/`    | No-op in initial scope (kept for future) |

Shared modules live under `entrypoints/shared/`. UI helpers live under `entrypoints/ui/`.

---

## 2. Manifest-Level Design

WXT generates the manifest from `wxt.config.ts`. Required changes:

```
permissions: ['storage', 'unlimitedStorage']
```

- Remove `tabs` permission (not needed — `chrome.tabs.create` works without it).
- Add `unlimitedStorage`.
- Set `chrome_url_overrides.newtab` to the newtab entrypoint (WXT handles this automatically for a `newtab` entrypoint).
- Add `action.default_popup` for the popup entrypoint.
- Keep existing icon configuration.
- Update `name` to `"TabMD"` and `description` to `"Markdown notes in every new tab."`.

---

## 3. File / Module Structure

### 3.1 Files to Remove (Scaffold Artifacts)

These files exist in the current scaffold but are not needed for TabMD:

| Path                                        | Reason                                      |
|---------------------------------------------|---------------------------------------------|
| `entrypoints/drive/`                        | Drive integration is out of scope           |
| `entrypoints/drive-auth/`                   | Drive auth is out of scope                  |
| `entrypoints/tabmd/`                        | Replaced by `entrypoints/newtab/`           |
| `entrypoints/shared/backup_filename.ts`     | JSON backup naming — not needed             |
| `entrypoints/shared/duplicates.ts`          | Collection dedup — not needed               |
| `entrypoints/shared/condense.ts`            | Dashboard tab singleton — not needed        |
| `entrypoints/background/condense.ts`        | Re-export of above — not needed             |
| `entrypoints/background/list_tab.ts`        | Dashboard URL helper — not needed           |
| `entrypoints/tabmd/onetab_import.ts`        | OneTab import — not needed                  |
| `entrypoints/tabmd/list.ts`                 | Collection list helpers — not needed        |
| `entrypoints/tabmd/restore.ts`              | Resource opener — not needed                |
| `docs/DRIVE_BACKUP_PLAN.md`                 | Drive doc — not needed                      |
| `docs/DRIVE_BACKUP_SPEC.md`                 | Drive doc — not needed                      |
| `docs/CWS_LISTING_DRAFT.md`                 | Scaffold listing — will be rewritten        |

### 3.2 Files to Keep and Adapt

| Path                                        | Changes                                              |
|---------------------------------------------|------------------------------------------------------|
| `entrypoints/shared/storage.ts`             | Replace collections model with notes model           |
| `entrypoints/shared/utils.ts`               | Keep `logExtensionError`, `formatTimestamp` as-is     |
| `entrypoints/shared/theme.css`              | Keep as-is — design token system is reusable         |
| `entrypoints/ui/notifications.ts`           | Keep `createSnackbarNotifier` as-is                  |
| `entrypoints/options/`                       | Simplify: remove `openInNewTab` and `compactCards`   |
| `entrypoints/background/index.ts`           | Simplify: remove action click handler (popup handles)|
| `wxt.config.ts`                             | Update manifest fields                               |
| `docs/architecture.md`                      | Rewrite for TabMD                                    |
| `docs/storage.md`                           | Rewrite for TabMD                                    |

### 3.3 New Files

| Path                                        | Purpose                                               |
|---------------------------------------------|-------------------------------------------------------|
| `entrypoints/newtab/index.html`             | New tab page HTML shell                               |
| `entrypoints/newtab/index.ts`               | New tab page init: editor, save, title, preview       |
| `entrypoints/newtab/editor.ts`              | EasyMDE setup, configuration, focus mode, native preview state |
| `entrypoints/newtab/save.ts`                | Real-time save tracking and lifecycle fallback        |
| `entrypoints/newtab/title.ts`               | Title derivation and manual override logic            |
| `entrypoints/newtab/preview.ts`             | Preview rendering (Markdown → HTML) used by EasyMDE preview hooks |
| `entrypoints/newtab/export.ts`              | Export current note as .md                            |
| `entrypoints/newtab/style.css`              | New tab page styles                                   |
| `entrypoints/popup/index.html`              | Popup HTML shell                                      |
| `entrypoints/popup/index.ts`                | Popup init: load notes, render list                   |
| `entrypoints/popup/style.css`               | Popup styles                                          |
| `entrypoints/list/index.html`               | Full list page HTML shell                             |
| `entrypoints/list/index.ts`                 | Full list page init: search, cards, CRUD              |
| `entrypoints/list/search.ts`                | Search/filter logic                                   |
| `entrypoints/list/style.css`                | Full list page styles                                 |
| `entrypoints/shared/notes.ts`               | Note CRUD operations (read, write, delete, list)      |
| `entrypoints/shared/note_title.ts`          | Title derivation utility (shared across surfaces)     |
| `entrypoints/shared/uuid.ts`                | UUID generation utility                               |

---

## 4. Storage Model

### 4.1 Storage Keys

| Key              | Type                        | Description                              |
|------------------|-----------------------------|------------------------------------------|
| `tabmd:settings` | `TabmdSettings`             | User preferences (theme)                 |
| `tabmd:notes`    | `Record<string, NoteRecord>`| All notes, keyed by note ID              |

### 4.2 NoteRecord Type

```typescript
type NoteRecord = {
  id: string;          // UUID v4
  content: string;     // Raw Markdown
  title: string | null;// null = use first-line derivation
  createdAt: number;   // Unix ms
  modifiedAt: number;  // Unix ms
};
```

### 4.3 TabmdSettings Type (Simplified)

```typescript
type ThemeMode = 'os' | 'light' | 'dark';

type TabmdSettings = {
  theme: ThemeMode;
};
```

Replaces the existing `TabmdSettings` which had `openInNewTab` and `compactCards`.

### 4.4 Why Object-Keyed Notes (Not an Array)

Notes are stored as `Record<string, NoteRecord>` rather than `NoteRecord[]` because:

- **O(1) lookup** by note ID on every new tab load. An array would require O(n) scan.
- **O(1) delete** — use `delete notesMap[id]` rather than filter.
- **O(1) upsert** — `notesMap[id] = updatedNote`.
- Sorting for display is O(n log n) but happens only in the list/popup, not on the critical new-tab path.

### 4.5 Storage Access Layer (`entrypoints/shared/notes.ts`)

Functions:

| Function               | Signature                                              | Description                          |
|------------------------|--------------------------------------------------------|--------------------------------------|
| `readAllNotes`         | `() → Promise<Record<string, NoteRecord>>`             | Read all notes from storage          |
| `readNote`             | `(id: string) → Promise<NoteRecord \| null>`           | Read a single note by ID             |
| `writeNote`            | `(note: NoteRecord) → Promise<void>`                   | Upsert a single note                 |
| `deleteNote`           | `(id: string) → Promise<void>`                         | Remove a note by ID                  |
| `listNotesSorted`      | `() → Promise<NoteRecord[]>`                           | All notes sorted by modifiedAt desc  |

`writeNote` reads the current map, sets the key, and writes back. This is the simplest correct approach given `chrome.storage.local` does not support partial key updates within a value.

### 4.6 Settings Access Layer

Keep the existing `readSettings` / `writeSettings` / `normalizeSettings` pattern from `entrypoints/shared/storage.ts`, but update the type to the simplified `TabmdSettings`.

---

## 5. Note Identity Strategy (URL Hash)

### 5.1 UUID Generation (`entrypoints/shared/uuid.ts`)

Use `crypto.randomUUID()` — available in all modern Chrome versions. No library needed.

### 5.2 New Tab Flow

1. Page loads. Read `location.hash.slice(1)`.
2. If empty:
   - Generate UUID via `crypto.randomUUID()`.
   - Set hash via `history.replaceState(null, '', '#' + id)` — avoids pushing a history entry.
   - Initialize an empty `NoteRecord` (not yet written to storage — written on first actual edit).
3. If non-empty:
   - Attempt to load `NoteRecord` from storage.
   - If found: populate editor with `content`.
   - If not found: treat as new note with that ID.

### 5.3 Opening Notes from Other Surfaces

All surfaces (popup, full list, search results) open notes via:

```
chrome.tabs.create({ url: chrome.runtime.getURL('newtab.html') + '#' + noteId })
```

This ensures the newtab entrypoint loads with the correct hash.

---

## 6. Interaction Model Across Surfaces

### 6.1 New Tab Page → Storage

- Reads note on load.
- Writes note immediately on editor and title changes, with `beforeunload` retained as a best-effort fallback.
- Subscribes to `chrome.storage.onChanged` so other open surfaces reflect title and content edits immediately.
- Multiple tabs pointed at the same note still use last-write-wins behavior.

### 6.2 Popup → Storage

- Reads all notes on popup open.
- Subscribes to `chrome.storage.onChanged` for live rerenders while the popup stays open.
- Navigates by creating new tabs with hash URLs.
- Never writes to storage.

### 6.3 Full List Page → Storage

- Reads all notes on load.
- Subscribes to `chrome.storage.onChanged` for live rerenders while the page stays open.
- Writes on rename (updates `title` field).
- Writes on delete (removes note).
- Navigates by creating new tabs.
- Search is client-side filtering of the already-loaded note set — no additional storage reads.

### 6.4 Options Page → Storage

- Reads/writes settings only. Does not touch notes.

### 6.5 Background Service Worker

- Minimal in initial scope. The popup is configured via `default_popup` in manifest, so no `action.onClicked` handler is needed.
- The background script can be reduced to an empty `defineBackground(() => {})` or removed entirely if WXT allows.

---

## 7. EasyMDE Usage and Constraints

### 7.1 Integration

EasyMDE is the sole third-party runtime dependency. Add via `pnpm add easymde`.

### 7.2 Configuration

```typescript
// Conceptual configuration — not runnable code
{
  element: document.getElementById('editor-textarea'),
  autofocus: true,
  placeholder: 'Start writing…',
  spellChecker: false,
  toolbar: false,         // TabMD uses its own UI controls
  status: false,          // No status bar
  previewRender: customPreviewFn,  // GFM + syntax highlighting
  shortcuts: { toggleFullScreen: null }  // Managed by TabMD's own button
}
```

### 7.3 Constraints

- **No EasyMDE toolbar** — TabMD has its own minimal UI (Editor/Preview tabs, focus mode button, export, options link). EasyMDE's built-in toolbar is disabled.
- **No EasyMDE status bar** — disabled.
- **No EasyMDE side-by-side** — not configured.
- **Focus mode** — keep the visible editor surface active, hide surrounding workspace chrome, and leave an explicit exit control on screen.
- **Preview** — use EasyMDE's `previewRender` hook as the single preview pipeline, and let TabMD's tabs switch EasyMDE's native preview mode on and off.

### 7.4 EasyMDE CSS

EasyMDE ships with its own CSS. Import it in the newtab entrypoint. Override styles as needed to match TabMD's theme system (use CSS custom properties).

---

## 8. Preview Rendering

### 8.1 Markdown Rendering

Use the `marked` library for GFM rendering. Add via `pnpm add marked`.

- Configure `marked` with `gfm: true`, `breaks: false`.
- `marked` supports tables and task lists out of the box with GFM mode.

### 8.2 Syntax Highlighting

Use `highlight.js` for fenced code block syntax highlighting. Add via `pnpm add highlight.js`.

- Integrate via `marked`'s `highlight` option or a `marked-highlight` extension.
- Include a reasonable subset of language grammars (common web/dev languages).
- Use highlight.js CSS themes that adapt to light/dark mode.

### 8.3 Preview Flow

1. User clicks "Preview" tab.
2. Read current content from EasyMDE: `easymde.value()`.
3. EasyMDE switches into preview mode.
4. EasyMDE calls `previewRender` with the current Markdown.
5. The preview surface displays the rendered HTML in-place.

### 8.4 Libraries Required

| Library        | Purpose                        | Approval Note                       |
|----------------|--------------------------------|-------------------------------------|
| `easymde`      | Markdown editor                | Explicitly specified in scope       |
| `marked`       | Markdown → HTML rendering      | Required for GFM preview            |
| `highlight.js` | Code syntax highlighting       | Required for fenced code blocks     |

No other third-party libraries should be added without explicit approval.

---

## 9. Search Implementation

### 9.1 Strategy

Search is client-side filtering over the in-memory note set. No indexing, no server.

### 9.2 Algorithm

1. On full list page load, read all notes into memory via `readAllNotes()`.
2. On each search input event:
   - Normalize the query: `query.trim().toLowerCase()`.
   - If query is empty, show all notes sorted by `modifiedAt` descending.
   - Otherwise, filter notes where the query appears in `resolvedTitle.toLowerCase()` or `content.toLowerCase()`.
   - For each matching note, compute one best snippet:
     - If the match is in the title, use the first non-empty content line.
     - If the match is in the content, extract the line containing the first occurrence.
   - Sort results by `modifiedAt` descending.
3. Re-render the card list.

### 9.3 Complexity

- **Filtering:** O(n) where n = number of notes. Each note's `content.toLowerCase().includes(query)` is O(m) where m = content length. Total: O(n·m).
- **For typical usage** (hundreds of notes, each a few KB), this is instantaneous. No optimization needed.
- **If performance ever became a concern** (unlikely with local-only storage), consider building a simple inverted index on first load. But this is not needed for initial implementation.

---

## 10. Title Derivation and Manual Override

### 10.1 Shared Utility (`entrypoints/shared/note_title.ts`)

```typescript
// Derives a display title from note content and manual title
function resolveNoteTitle(note: { title: string | null; content: string }): string
```

Logic:
1. If `note.title` is a non-empty string (after trimming), return it.
2. Extract the first line of `note.content`.
3. Strip leading `#` characters and whitespace.
4. If the result is non-empty, return it.
5. Otherwise, return `"Untitled"`.

### 10.2 Data Representation

- `title: null` → auto-title mode (first-line derivation).
- `title: "Some Title"` → manual override mode.
- Setting `title` to `""` or whitespace-only → normalize to `null` (revert to auto-title).

This utility is used by: newtab page (title area), popup (note list), full list page (card titles), export (filename).

---

## 11. Real-Time Save Tracking

### 11.1 Implementation (`entrypoints/newtab/save.ts`)

1. Track `lastSavedContent` — initialized from the loaded note's content (or empty string for new notes).
2. Listen to editor-content and title-commit events.
3. Serialize saves so only one `chrome.storage.local.set` runs at a time.
4. For each save attempt:
   - Read current content from EasyMDE: `easymde.value()`.
   - If content and title both match the last saved snapshot, skip (no-op).
   - Otherwise, call `writeNote({ ...note, content, modifiedAt: Date.now() })`.
   - Update the tracked saved snapshot.
5. Also listen to `window.addEventListener('beforeunload', ...)` as a safety net.
   - This is still best-effort because the browser may not await the async storage write.

### 11.2 No Autosave Timer

- No `setInterval` or debounced save.
- No "save" button.
- Save happens exactly on visibility loss.

---

## 12. Export of Current Note

### 12.1 Implementation (`entrypoints/newtab/export.ts`)

1. Read current note content from EasyMDE.
2. Resolve the note title via `resolveNoteTitle`.
3. Sanitize the title for use as a filename: replace `[\\/:*?"<>|]` with `-`.
4. Create a `Blob` with content type `text/markdown`.
5. Create a download link using `URL.createObjectURL`.
6. Trigger download with `link.click()`.
7. Clean up: revoke object URL, remove link.

This is the same Blob + anchor pattern used in the existing scaffold's `exportJson()`.

---

## 13. Theme Settings Storage and Application

### 13.1 Storage

- Stored in `tabmd:settings` as `{ theme: 'os' | 'light' | 'dark' }`.
- Default: `{ theme: 'os' }`.
- Read via `readSettings()`, write via `writeSettings()`.

### 13.2 Application

- All pages call `applyTheme(settings.theme)` on init.
- `applyTheme` logic (existing scaffold pattern):
  - `'os'` → remove `data-theme` attribute from `<html>` (CSS `@media (prefers-color-scheme: dark)` takes over).
  - `'light'` → set `data-theme="light"`.
  - `'dark'` → set `data-theme="dark"`.
- The existing `theme.css` already handles all three modes via CSS custom properties.
- EasyMDE's editor area must also respect these theme tokens. Override EasyMDE's default colors using CSS custom properties that reference the theme tokens.

---

## 14. Implementation Phases

### Phase 1: Foundation (Storage, Types, Cleanup)

1. Remove scaffold files listed in §3.1.
2. Update `entrypoints/shared/storage.ts`:
   - Replace `WorkspaceCollection` / `ResourceItem` types with `NoteRecord`.
   - Simplify `TabmdSettings` (remove `openInNewTab`, `compactCards`).
   - Update `STORAGE_KEYS` (add `notes`, remove `collections`).
   - Update `normalizeSettings` for simplified type.
3. Create `entrypoints/shared/notes.ts` with note CRUD functions.
4. Create `entrypoints/shared/note_title.ts` with `resolveNoteTitle`.
5. Create `entrypoints/shared/uuid.ts` with UUID generation.
6. Update unit tests for new storage model and note operations.

### Phase 2: New Tab Editor Page

1. Create `entrypoints/newtab/index.html` with HTML shell (title area, tab bar, editor container, toolbar).
2. Install `easymde` dependency.
3. Create `entrypoints/newtab/editor.ts` — EasyMDE initialization and configuration.
4. Create `entrypoints/newtab/save.ts` — real-time save tracking logic.
5. Create `entrypoints/newtab/title.ts` — title area UI behavior (show/hide, derive/override).
6. Create `entrypoints/newtab/index.ts` — page init, hash routing, wiring.
7. Create `entrypoints/newtab/style.css` — page styles using theme tokens.
8. Update `wxt.config.ts` — manifest permissions, metadata.
9. Add unit tests for save, title, and hash logic.

### Phase 3: Preview

1. Install `marked` and `highlight.js` dependencies.
2. Create `entrypoints/newtab/preview.ts` — render Markdown to HTML.
3. Wire preview tab switching in `entrypoints/newtab/index.ts`.
4. Add highlight.js CSS (light/dark aware) to newtab styles.
5. Add unit tests for preview rendering.

### Phase 4: Popup

1. Create `entrypoints/popup/index.html`.
2. Create `entrypoints/popup/index.ts` — load notes, render list, navigation.
3. Create `entrypoints/popup/style.css`.
4. Add integration tests for popup rendering.

### Phase 5: Full List Page

1. Create `entrypoints/list/index.html`.
2. Create `entrypoints/list/search.ts` — search/filter logic.
3. Create `entrypoints/list/index.ts` — cards, search, rename, delete, new note.
4. Create `entrypoints/list/style.css`.
5. Add unit tests for search logic.
6. Add integration tests for list page.

### Phase 6: Options Page Simplification

1. Update `entrypoints/options/index.html` — remove `openInNewTab` and `compactCards` checkboxes.
2. Update `entrypoints/options/settings_page.ts` — simplify to theme-only.
3. Update `entrypoints/options/style.css` if needed.
4. Update integration tests for options page.

### Phase 7: Export and Focus Mode

1. Create `entrypoints/newtab/export.ts` — download current note as `.md`.
2. Wire focus mode button to the visible editor surface and keep an explicit exit control visible.
3. Add unit tests for export filename sanitization.

### Phase 8: Background Simplification & Final Cleanup

1. Simplify `entrypoints/background/index.ts` — remove action click handler (popup is now `default_popup`).
2. Update `docs/README.md`, `docs/architecture.md`, `docs/storage.md`.
3. Update `docs/TESTING.md`, `docs/TEST_PLAN.md`.
4. Update `docs/CWS_LISTING_DRAFT.md` for TabMD.

---

## 15. Testing Strategy

### 15.1 Test Organization

All test files live under `tests/`, completely separate from production code:

```
tests/
  unit/
    notes_storage.test.ts      # Note CRUD operations
    note_title.test.ts         # Title derivation
    uuid.test.ts               # UUID generation
    search.test.ts             # Search/filter logic
    save_logic.test.ts         # Real-time save tracking logic
    export.test.ts             # Export filename sanitization
    settings.test.ts           # Settings normalization
    ui_notifications.test.ts   # Snackbar notifier (existing)
  integration/
    newtab_init.test.ts        # New tab page bootstrap
    popup_render.test.ts       # Popup note list rendering
    list_page.test.ts          # Full list page rendering
    options_page.test.ts       # Options page bootstrap
  e2e/
    extension.spec.ts          # Extension loads, pages render
```

### 15.2 Unit Tests

- Run with Vitest.
- Mock `chrome.storage.local` using the existing `tests/helpers/mock_chrome.ts`.
- Test pure functions directly: `resolveNoteTitle`, search filtering, filename sanitization, settings normalization.
- Test storage operations against the mock.

### 15.3 Integration Tests

- Run with Vitest + jsdom.
- Verify DOM bootstrapping of each page surface.
- Mock `chrome` APIs and verify that init functions wire up expected DOM state.

### 15.4 E2E Tests

- Run with Playwright against a built extension.
- Verify:
  - Extension loads without errors.
  - New tab page renders the editor.
  - Popup renders.
  - Full list page renders.
  - Options page renders.

### 15.5 Coverage

- Maintain or increase coverage — never decrease.
- `vitest.config.ts` coverage includes `entrypoints/**/*.ts`, excludes test files and type declarations.

---

## 16. Edge-Case Validation Strategy

| Edge Case                                    | How to Validate                                                      |
|----------------------------------------------|----------------------------------------------------------------------|
| Empty hash on new tab                        | Unit test: verify UUID generation and hash setting                   |
| Hash with nonexistent note ID                | Unit test: verify graceful fallback to new note                      |
| Same note open in two tabs                   | Manual E2E: edit in both, verify last-save-wins without crash        |
| Very large note content                      | Integration test: write/read a 1 MB string                           |
| Whitespace-only content                      | Unit test: `resolveNoteTitle` returns "Untitled"                     |
| Whitespace-only manual title                 | Unit test: normalizes to `null`                                      |
| Storage write failure                        | Unit test: mock rejection, verify error logging                      |
| Delete last note                             | Integration test: list page shows empty state                        |
| Search with no results                       | Unit test: verify empty result set                                   |
| Search with special regex characters          | Unit test: verify literal matching, not regex interpretation         |
| Export with special characters in title       | Unit test: verify filename sanitization                              |
| Rapid tab opening (UUID uniqueness)           | Unit test: generate 1000 UUIDs, verify uniqueness                    |

---

## 17. Risks and Mitigation

| Risk                                           | Likelihood | Mitigation                                                          |
|------------------------------------------------|------------|---------------------------------------------------------------------|
| EasyMDE CSS conflicts with theme tokens        | Medium     | Override EasyMDE styles with specificity-matched CSS using theme vars |
| `chrome.storage.local` write contention (two tabs writing same key) | Low | Accept last-write-wins. Document behavior. No locking.              |
| `beforeunload` handler not reliably saving     | Medium     | Primary save is `visibilitychange`. `beforeunload` is best-effort.  |
| Large note count slowing popup                 | Low        | Cap popup list to a small configured recent-note limit. Full list page handles the rest.  |
| `marked` XSS from rendered HTML               | Medium     | Use `marked`'s `sanitize` option or DOMPurify. Verify.              |
| highlight.js bundle size                       | Low        | Import only common language subsets, not the full bundle.            |
| EasyMDE preview DOM or focus styling conflicting with page layout | Low | Test preview and focus transitions against the page shell and override styles locally. |
