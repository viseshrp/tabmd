# Storage Model

TabMD stores everything locally in the extension environment using `chrome.storage.local` with the `unlimitedStorage` permission to ensure notes aren't silently truncated by browser quotas. Google Drive backup is optional and manual; it adds local metadata keys plus remote backup files in the user's own Drive account.

## Storage Keys

```typescript
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

### Drive Backup Metadata

These keys support the manual Google Drive backup feature in the options page. They are local cache/settings only; the backup file contents themselves live in the user's Google Drive.

```typescript
type DriveBackupEntry = {
  fileId: string;
  fileName: string;
  timestamp: number;
  size: number;
  noteCount: number;
};

type DriveBackupIndex = {
  installId: string;
  backups: DriveBackupEntry[];
};
```

### Drive Backup Payload

Each uploaded Drive backup stores a full snapshot of notes and settings:

```typescript
type SerializedBackupPayload = {
  version: number;
  timestamp: number;
  installId: string;
  notes: Record<string, NoteRecord>;
  settings: TabmdSettings;
};
```
