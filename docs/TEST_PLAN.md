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
| **Runtime Initializations** | `tests/integration/` | Background service loading checks and visual UI rendering configurations. |
| **Popup Navigation** | `tests/integration/popup_entrypoint.test.ts` | Verifies the recent-notes popup opens the built full-list route (`list.html`) instead of the source entrypoint path. |

## Running Checks

```bash
pnpm test
```
The above should resolve the entire test branch and compute 100% logical structural coverage explicitly.
