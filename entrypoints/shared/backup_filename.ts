/**
 * Shared backup snapshot naming helpers used by the Drive backup feature.
 * Backups are stored as one `.zip` file per snapshot, while each note inside
 * the archive still uses the shared Markdown export filename helper.
 */

/** File prefix used for all TabMD backup files stored in Google Drive. */
export const TABMD_BACKUP_FILE_PREFIX = "tabmd-backup";
export const TABMD_BACKUP_FILE_EXTENSION = ".zip";

/**
 * Converts an epoch-ms timestamp into a filename-safe ISO segment.
 * Replacing `:` and `.` keeps the result Windows-friendly while preserving UTC ordering.
 */
export function formatBackupTimestampSegment(timestampMs: number): string {
	const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
	return new Date(safeTimestamp).toISOString().replace(/[:.]/g, "-");
}

/** Builds the canonical snapshot base name shared by legacy folders and zip files. */
export function createTabmdBackupSnapshotBaseName(
	timestampMs: number,
	noteCount: number,
): string {
	const timestampSegment = formatBackupTimestampSegment(timestampMs);
	const normalizedNoteCount = Math.max(0, Math.floor(noteCount));
	return `${TABMD_BACKUP_FILE_PREFIX}-${timestampSegment}-n${normalizedNoteCount}`;
}

/**
 * Builds the canonical Drive backup archive name:
 * `tabmd-backup-<timestamp>-n<noteCount>.zip`
 */
export function createTabmdBackupSnapshotName(
	timestampMs: number,
	noteCount: number,
): string {
	return `${createTabmdBackupSnapshotBaseName(timestampMs, noteCount)}${TABMD_BACKUP_FILE_EXTENSION}`;
}

/** Removes the optional `.zip` suffix so legacy folders and current archives parse identically. */
function stripBackupArchiveExtension(fileName: string): string {
	return fileName.toLowerCase().endsWith(TABMD_BACKUP_FILE_EXTENSION)
		? fileName.slice(0, -TABMD_BACKUP_FILE_EXTENSION.length)
		: fileName;
}

/** Extracts the `-n<noteCount>` suffix from either a legacy folder or a zip snapshot name. */
export function extractNoteCountFromBackupFileName(fileName: string): number {
	const match = /-n(\d+)$/i.exec(stripBackupArchiveExtension(fileName));
	if (!match) {
		return 0;
	}

	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
