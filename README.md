# TabMD

TabMD is a Chrome MV3 extension that replaces the default new tab page with a local-first Markdown editor. Every new tab gets its own note, identified by a UUID in the URL hash, and all note data stays in `chrome.storage.local`.

The current implementation is intentionally narrow:

- Offline only
- No accounts or sync
- No network permissions
- One note per tab
- Save on tab blur / page hide
- Popup for recent notes
- Full list page for search, rename, and delete

## Features

- Markdown editing with [EasyMDE](https://github.com/Ionaru/easy-markdown-editor)
- Preview mode using GitHub-flavored Markdown via `marked`
- Syntax-highlighted fenced code blocks via `highlight.js`
- Automatic note titles derived from the first meaningful line
- Manual title overrides
- Export current note as a `.md` file
- Focus mode using the editor's fullscreen support
- Theme setting with `os`, `light`, and `dark` modes
- Recent-notes popup limited to the 20 most recently edited notes
- Full notes page with client-side search across titles and body content

## Product Model

### Note identity

Each note is addressed by the hash on the new tab page:

```text
newtab.html#<uuid>
```

If the hash is missing, TabMD generates a new UUID with `crypto.randomUUID()` and updates the current URL in place.

### Persistence

TabMD stores two keys in `chrome.storage.local`:

```ts
const STORAGE_KEYS = {
  settings: 'tabmd:settings',
  notes: 'tabmd:notes'
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

## Runtime Surfaces

### New tab page

Path: `entrypoints/newtab/`

Responsibilities:

- Resolve or create the current note ID from `location.hash`
- Load the note from storage
- Initialize the EasyMDE editor
- Save content and title changes on `visibilitychange` / `beforeunload`
- Toggle editor and preview modes
- Export the current note
- Open the options page

### Popup

Path: `entrypoints/popup/`
Runtime page: `popup.html`

Responsibilities:

- Load all notes on popup open
- Select the 20 most recent notes without fully sorting the complete collection
- Render the 20 most recent notes
- Open the selected note in a new tab
- Navigate to the full list page or options page

### Full list page

Path: `entrypoints/list/`
Runtime page: `list.html`

Responsibilities:

- Load and sort all notes
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

### Background service worker

Path: `entrypoints/background/index.ts`

The background worker is intentionally minimal. The popup is wired from the manifest, so there is no action-click routing logic in the worker.

## Project Structure

```text
entrypoints/
  background/   background service worker
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
- Background entrypoint loading
- Options entrypoint initialization

See [`TEST_PLAN.md`](/Users/viseshprasad/Documents/GitHub/tabmd/TEST_PLAN.md) and [`TESTING.md`](/Users/viseshprasad/Documents/GitHub/tabmd/TESTING.md) for the test plan and local workflow notes.

## Manifest and Permissions

The extension currently requests:

- `storage`
- `unlimitedStorage`

No network permission is required. No remote sync path is implemented.

## Known Constraints

- Save behavior is blur-driven, not per-keystroke.
- Multiple tabs pointed at the same note use last-write-wins behavior.
- Search is client-side over the in-memory note list loaded for the page.
- Notes are local to the browser profile where the extension is installed.

## Related Docs

- [`SPEC.md`](/Users/viseshprasad/Documents/GitHub/tabmd/SPEC.md)
- [`IMPLEMENTATION_PLAN.md`](/Users/viseshprasad/Documents/GitHub/tabmd/IMPLEMENTATION_PLAN.md)
- [`docs/architecture.md`](/Users/viseshprasad/Documents/GitHub/tabmd/docs/architecture.md)
- [`docs/storage.md`](/Users/viseshprasad/Documents/GitHub/tabmd/docs/storage.md)
- [`PRIVACY_POLICY.md`](/Users/viseshprasad/Documents/GitHub/tabmd/PRIVACY_POLICY.md)

## Status

The repository is no longer a generic WXT scaffold. It now contains a working TabMD implementation centered on a local-only Markdown new tab workflow.
