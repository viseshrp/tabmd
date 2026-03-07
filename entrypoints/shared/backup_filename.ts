export function createTabmdBackupFileName(timestamp: number, collectionCount: number): string {
  const iso = new Date(timestamp).toISOString().slice(0, 10);
  return `tabmd-backup-${iso}-${collectionCount}-collections.json`;
}

