# TabMD Test Plan

This document outlines the testing strategy for the TabMD extension to ensure logic correctly matches `SPEC.md`.

## Testing Matrix

| Component | Test File | Key Coverage Area |
| :--- | :--- | :--- |
| **Note UUIDs** | `tests/unit/uuid.test.ts` | UUID uniqueness and structure. |
| **Search Logic** | `tests/unit/search.test.ts`, `tests/unit/search_large_input.test.ts` | Search behavior: matching titles, parsing contents, handling case-insensitivity, generating readable snippets, and avoiding eager normalization of large note bodies. |
| **Save Logic** | Manual browser check | Testing visibility state and unloads against storage writes to ensure changes aren't lost unless a hard crash occurs. |
| **Note Title Parser** | `tests/unit/note_title.test.ts` | Derivation of manual titles, extracting `# Headings` as automatic titles, fallback to "Untitled". |
| **Notes Storage** | `tests/unit/notes_storage.test.ts` | Operations checking empty states locally and mapping correct `modifiedAt`/`createdAt` chronologies explicitly. |
| **Blob Export** | `tests/unit/export.test.ts` | File name sanitization over the export sequence via Anchor clicks. |
| **Drive Auth** | `tests/unit/drive_auth.test.ts` | OAuth token retrieval, cached-token handling, and user-facing auth error formatting. |
| **Drive REST API** | `tests/unit/drive_api.test.ts` | Folder lookup/creation, file listing, uploads, downloads, and delete handling. |
| **Drive Backup Flow** | `tests/unit/drive_backup.test.ts` | Snapshot-folder creation, per-note Markdown uploads, retention, install-folder separation, local index caching, pagination, fallback behavior, and restore logic. |
| **Preview Rendering** | `tests/unit/preview.test.ts`, `tests/unit/preview_large_input.test.ts` | Validates the shared Markdown-to-HTML renderer used by EasyMDE's preview pipeline, including deterministic plaintext fallbacks that avoid expensive auto-detection on large code fences. |
| **Markdown Import/Export** | `tests/unit/note_markdown.test.ts`, `tests/unit/note_markdown_large_input.test.ts` | Covers frontmatter serialization/parsing, malformed metadata fallback behavior, and large backup-note restores without truncating or rewriting the body. |
| **Editor View State** | `tests/unit/editor_focus_mode.test.ts` | Verifies focus mode state, Escape handling, synchronous preview/editor tab transitions, and editor refreshes when the writing surface becomes visible again. |
| **Editor Style Contracts** | `tests/unit/newtab_style.test.ts` | Locks the preview-mode scrollbar contract so rendered Markdown is the only active scroller while the hidden CodeMirror surface stays visually inert. |
| **Runtime Initializations** | `tests/integration/` | Background service loading checks and visual UI rendering configurations. |
| **Large Note List UI** | `tests/integration/list_large_note_entrypoint.test.ts` | Exercises the real list-page DOM flow with large notes so title and content search stay correct on long note bodies. |
| **Popup Navigation** | `tests/integration/popup_entrypoint.test.ts` | Verifies the recent-notes popup opens the built full-list route (`list.html`) instead of the source entrypoint path. |
| **Popup Style Contracts** | `tests/unit/popup_style.test.ts` | Verifies recent-note titles stay width-bound and truncate with a single-line ellipsis instead of introducing horizontal scrolling. |
| **Drive Options UI** | `tests/integration/drive_backup.test.ts` | Connect/disconnect, backup-now, lazy restore list loading, delete, restore, pagination, page-size changes, and failure handling from the options page. |

## Running Checks

```bash
pnpm test
```
The above should resolve the entire test branch and exercise the local note-taking workflow plus the optional manual Google Drive backup path.
