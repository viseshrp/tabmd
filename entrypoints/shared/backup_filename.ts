/**
 * Shared backup snapshot naming helpers used by the Drive backup feature.
 * Snapshot folders keep a readable sortable timestamp, while each note file
 * inside the folder uses the shared Markdown export filename helper.
 */

/** File prefix used for all TabMD backup files stored in Google Drive. */
export const TABMD_BACKUP_FILE_PREFIX = "tabmd-backup";

/**
 * Converts an epoch-ms timestamp into a filename-safe ISO segment.
 * Replacing `:` and `.` keeps the result Windows-friendly while preserving UTC ordering.
 */
export function formatBackupTimestampSegment(timestampMs: number): string {
	const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : Date.now();
	return new Date(safeTimestamp).toISOString().replace(/[:.]/g, "-");
}

/**
 * Builds the canonical Drive backup snapshot folder name:
 * `tabmd-backup-<timestamp>-n<noteCount>`
 */
export function createTabmdBackupSnapshotName(
	timestampMs: number,
	noteCount: number,
): string {
	const timestampSegment = formatBackupTimestampSegment(timestampMs);
	const normalizedNoteCount = Math.max(0, Math.floor(noteCount));
	return `${TABMD_BACKUP_FILE_PREFIX}-${timestampSegment}-n${normalizedNoteCount}`;
}

/** Extracts the `-n<noteCount>` suffix from a snapshot folder name. */
export function extractNoteCountFromBackupFileName(fileName: string): number {
	const match = /-n(\d+)$/i.exec(fileName);
	if (!match) {
		return 0;
	}

	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
