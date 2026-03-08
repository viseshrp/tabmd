/**
 * Shared backup filename helpers used by the Drive backup feature.
 * The timestamp stays readable and sortable, and the note-count suffix lets
 * the options page show rough snapshot size without downloading the file.
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
 * Builds the canonical Drive backup filename:
 * `tabmd-backup-<timestamp>-n<noteCount>.json`
 */
export function createTabmdBackupFileName(
	timestampMs: number,
	noteCount: number,
): string {
	const timestampSegment = formatBackupTimestampSegment(timestampMs);
	const normalizedNoteCount = Math.max(0, Math.floor(noteCount));
	return `${TABMD_BACKUP_FILE_PREFIX}-${timestampSegment}-n${normalizedNoteCount}.json`;
}

/**
 * Extracts the `-n<noteCount>` suffix from a backup filename.
 * Non-canonical names simply report `0` so foreign files can still be listed safely.
 */
export function extractNoteCountFromBackupFileName(fileName: string): number {
	const match = /-n(\d+)\.json$/i.exec(fileName);
	if (!match) {
		return 0;
	}

	const parsed = Number(match[1]);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
