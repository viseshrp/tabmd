# Storage Model

TabMD stores everything completely offline in the local extension environment using `chrome.storage.local` with the `unlimitedStorage` permission to ensure notes aren't silently truncated by browser quotas.

## Storage Keys

```typescript
const STORAGE_KEYS = {
  settings: 'tabmd:settings',
  notes: 'tabmd:notes'
} as const;
```

## Schemas

### Notes Storage

Notes are stored as a mapped dictionary object where the keys are the `UUIDv4` note ID hashes. This gives near O(1) reads, updates, and deletes for active notes.

```typescript
export type NoteRecord = {
  id: string;          // UUID v4
  content: string;     // Raw Markdown
  title: string | null;// null = use first-line derivation
  createdAt: number;   // Unix ms
  modifiedAt: number;  // Unix ms
};
```

### Settings Schema

```typescript
export type TabmdSettings = {
  theme: 'os' | 'light' | 'dark';
};
```
