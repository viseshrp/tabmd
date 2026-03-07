# TabMD Test Plan

This document outlines the testing strategy for the TabMD extension to ensure logic correctly matches `SPEC.md`.

## Testing Matrix

| Component | Test File | Key Coverage Area |
| :--- | :--- | :--- |
| **Note UUIDs** | `tests/unit/uuid.test.ts` | UUID uniqueness and structure. |
| **Search Logic** | `tests/unit/search.test.ts` | Search behavior: matching titles, parsing contents, handling case-insensitivity, and generating readable snippets. |
| **Save Logic** | Manual browser check | Testing visibility state and unloads against storage writes to ensure changes aren't lost unless a hard crash occurs. |
| **Note Title Parser** | `tests/unit/note_title.test.ts` | Derivation of manual titles, extracting `# Headings` as automatic titles, fallback to "Untitled". |
| **Notes Storage** | `tests/unit/notes_storage.test.ts` | Operations checking empty states locally and mapping correct `modifiedAt`/`createdAt` chronologies explicitly. |
| **Blob Export** | `tests/unit/export.test.ts` | File name sanitization over the export sequence via Anchor clicks. |
| **Drive Auth** | `tests/unit/drive_auth.test.ts` | OAuth token retrieval, cached-token handling, and user-facing auth error formatting. |
| **Drive REST API** | `tests/unit/drive_api.test.ts` | Folder lookup/creation, file listing, uploads, downloads, and delete handling. |
| **Drive Backup Flow** | `tests/unit/drive_backup.test.ts` | Backup serialization, retention, local index caching, pagination, and restore logic. |
| **Preview Rendering** | `tests/unit/preview.test.ts` | Validates the shared Markdown-to-HTML renderer used by EasyMDE's preview pipeline, including syntax highlighting fallbacks. |
| **Editor View State** | `tests/unit/editor_focus_mode.test.ts` | Verifies focus mode state, Escape handling, preview-mode delegation to EasyMDE, and editor refreshes when the writing surface becomes visible again. |
| **Runtime Initializations** | `tests/integration/` | Background service loading checks and visual UI rendering configurations. |
| **Popup Navigation** | `tests/integration/popup_entrypoint.test.ts` | Verifies the recent-notes popup opens the built full-list route (`list.html`) instead of the source entrypoint path. |
| **Drive Options UI** | `tests/integration/drive_backup.test.ts` | Connect/disconnect, backup-now, restore list loading, and restore execution from the options page. |

## Running Checks

```bash
pnpm test
```
The above should resolve the entire test branch and exercise the local note-taking workflow plus the optional manual Google Drive backup path.
