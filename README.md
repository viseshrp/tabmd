# TabMD

TabMD is a Chrome MV3 extension that replaces the default new tab page with a local-first Markdown editor. Every new tab gets its own note, identified by a UUID in the URL hash, and all note data stays in `chrome.storage.local`.

The current implementation is intentionally narrow:

- Local-first by default
- No automatic sync or background upload
- Optional manual Google Drive backup/restore
- One note per tab
- Real-time local note persistence across open UI surfaces
- Popup for recent notes
- Full list page for search, rename, and delete

## Features

- Markdown editing with [EasyMDE](https://github.com/Ionaru/easy-markdown-editor)
- Preview mode using EasyMDE's native preview surface with GitHub-flavored Markdown via `marked`
- Editor and preview surfaces that fill the remaining workspace area inside the new-tab writing canvas
- Syntax-highlighted fenced code blocks via `highlight.js`
- Automatic note titles derived from the first meaningful line
- Manual title overrides
- Export current note as a `.md` file
- Focus mode that expands the editor to the full workspace while keeping an explicit exit control visible
- Theme setting with `os`, `light`, and `dark` modes
- Optional manual Google Drive backup/restore with retention, delete, and restore pagination
- Recent-notes popup limited to a small configurable set of the most recently edited notes
- Full notes page with client-side search across titles and body content

## Product Model

### Note identity

Each note is addressed by the hash on the new tab page:

```text
newtab.html#<uuid>
```

If the hash is missing, TabMD generates a new UUID with `crypto.randomUUID()` and updates the current URL in place.

### Persistence

TabMD stores note data in `chrome.storage.local` and keeps a few additional local-only keys for optional Drive backup metadata:

```ts
const STORAGE_KEYS = {
  settings: 'tabmd:settings',
  notes: 'tabmd:notes'
} as const;

const DRIVE_STORAGE_KEYS = {
  driveBackupIndex: 'tabmd:driveBackupIndex',
  installId: 'tabmd:driveInstallId',
  retentionCount: 'tabmd:driveRetentionCount'
} as const;
```

Notes are stored as an object map rather than an array:

```ts
type NoteRecord = {
  id: string;
  content: string;
  title: string | null;
  createdAt: number;
  modifiedAt: number;
};
```

That shape keeps note load, upsert, and delete operations simple and effectively constant-time by note ID.

Drive backups stay isolated per extension install. Each install gets a stable local `installId`, and Drive files are written under:

```text
tabmd_backups/<installId>/
```

That separation lets multiple TabMD installs coexist without mixing backup files in the same Drive folder.

## Runtime Surfaces

### New tab page

Path: `entrypoints/newtab/`

Responsibilities:

- Resolve or create the current note ID from `location.hash`
- Load the note from storage
- Initialize the EasyMDE editor
- Save content and title changes immediately on editor or title edits
- Reconcile with `chrome.storage.onChanged` so open surfaces stay in sync
- Toggle Editor and Preview tabs through EasyMDE's native preview mode while keeping both surfaces stretched to the remaining workspace area
- Export the current note
- Open the options page

### Popup

Path: `entrypoints/popup/`
Runtime page: `popup.html`

Responsibilities:

- Load all notes on popup open
- Rerender when note storage changes while the popup is open
- Select the configured recent-notes popup cap without fully sorting the complete collection
- Render the configured recent-notes popup cap
- Open the selected note in a new tab
- Navigate to the full list page or options page

### Full list page

Path: `entrypoints/list/`
Runtime page: `list.html`

Responsibilities:

- Load and sort all notes
- Rerender when note storage changes while the list page is open
- Search across derived titles and note content using cached normalized metadata per page load
- Show a snippet for each matching note
- Rename notes
- Delete notes
- Open notes or create a brand-new note

### Options page

Path: `entrypoints/options/`

Responsibilities:

- Read and write the theme setting
- Apply the chosen theme immediately
- Show a snackbar after saves
- Connect/disconnect Google Drive for manual backups
- Upload note snapshots to Drive and restore them on demand
- Load the restore list lazily into a dialog
- Delete individual Drive backups from that dialog
- Manage retention and explicit restore-dialog pagination

### Background service worker

Path: `entrypoints/background/index.ts`

The background worker is intentionally minimal. The popup is wired from the manifest, so there is no action-click routing logic in the worker.

## Project Structure

```text
entrypoints/
  background/   background service worker
  drive/        Google Drive auth, REST API, and backup orchestration
  list/         note management page
  newtab/       editor surface
  options/      settings page
  popup/        recent-notes popup
  shared/       storage, note, title, and utility helpers
  ui/           shared UI helpers
tests/
  helpers/      Chrome API mocks and async test helpers
  integration/  entrypoint bootstrapping checks
  unit/         pure logic and storage tests
docs/
  architecture.md
  storage.md
  CWS_LISTING_DRAFT.md
```

## Stack

- [WXT](https://wxt.dev) for extension bundling
- TypeScript
- EasyMDE
- marked
- highlight.js
- Vitest
- JSDOM
- Playwright
- Biome

## Development

### Requirements

- Node.js 18+
- `pnpm`

### Install

```bash
pnpm install
```

`postinstall` runs `wxt prepare`, so extension types are generated automatically.

### Run locally

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Package

```bash
pnpm zip
```

### Quality checks

```bash
pnpm compile
pnpm lint
pnpm smoke
pnpm test
```

### End-to-end tests

```bash
pnpm test:e2e
```

## Testing

Current automated coverage focuses on:

- Title derivation
- UUID generation
- Search and snippet selection
- Notes storage CRUD behavior
- Export filename sanitization
- Google Drive auth, Drive REST helpers, backup orchestration, and options-page backup flows
- Background entrypoint loading
- Options entrypoint initialization

See [`TEST_PLAN.md`](/Users/viseshprasad/Documents/GitHub/tabmd/TEST_PLAN.md) and [`TESTING.md`](/Users/viseshprasad/Documents/GitHub/tabmd/TESTING.md) for the test plan and local workflow notes.

## Manifest and Permissions

The extension currently requests:

- `storage`
- `unlimitedStorage`
- `identity`
- `https://www.googleapis.com/` host permission

Google Drive backup is manual and optional. TabMD now uses its own fixed manifest key so it can coexist with `nufftabs` as a separate unpacked extension. The current baked-in OAuth client ID is still the reference one, so Drive auth must be re-provisioned for TabMD's extension ID before authentication will succeed.

Current TabMD extension ID from the baked-in key:

- `npgocjgphlckhehmcghiokimajkmmdef`

## Google Drive Manual Backup

1. Open the options page.
2. Click `Connect to Google Drive` and approve access.
3. Set `Retention` to the number of backups you want to keep.
4. Click `Backup now` to upload all notes.
5. Click `Restore from backup` to browse Drive snapshots lazily in the restore dialog.
6. Use `Previous`, `Next`, and the page-size selector to page through backups.
7. Click `Restore` to overwrite local notes with the selected snapshot, or `Delete` to remove a Drive backup file without restoring it.

## Known Constraints

- Open TabMD surfaces reflect title and content updates as soon as the note is persisted.
- Multiple tabs pointed at the same note use last-write-wins behavior.
- Search is client-side over the in-memory note list loaded for the page.
- Notes are local to the browser profile unless you explicitly run a manual Drive backup.
- Drive backup is manual only. It is not sync, merge, or background replication.

## Related Docs

- [`SPEC.md`](/Users/viseshprasad/Documents/GitHub/tabmd/SPEC.md)
- [`IMPLEMENTATION_PLAN.md`](/Users/viseshprasad/Documents/GitHub/tabmd/IMPLEMENTATION_PLAN.md)
- [`docs/architecture.md`](/Users/viseshprasad/Documents/GitHub/tabmd/docs/architecture.md)
- [`docs/storage.md`](/Users/viseshprasad/Documents/GitHub/tabmd/docs/storage.md)
- [`PRIVACY_POLICY.md`](/Users/viseshprasad/Documents/GitHub/tabmd/PRIVACY_POLICY.md)

## Status

The repository is no longer a generic WXT scaffold. It now contains a working TabMD implementation centered on a local-first Markdown new tab workflow with optional manual Google Drive backup.
