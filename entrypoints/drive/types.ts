/**
 * Shared Drive-backup types and constants used by the backup orchestration,
 * Drive REST client, and options-page UI.
 */
import type { NoteRecord } from "../shared/storage";
import {
	createTabmdBackupFileName,
	extractNoteCountFromBackupFileName,
} from "../shared/backup_filename";

/** The root folder used for TabMD backups inside the user's Google Drive. */
export const DRIVE_FOLDER_NAME = "tabmd_backups";

/** Current schema version for the JSON payload written into each backup file. */
export const BACKUP_VERSION = 1;

/** Default number of remote backups kept per install folder. */
export const DEFAULT_RETENTION_COUNT = 10;

/** Lowest and highest values accepted from user input and storage. */
export const MIN_RETENTION_COUNT = 1;
export const MAX_RETENTION_COUNT = 500;

/** Storage keys reserved for optional Drive backup metadata. */
export const DRIVE_STORAGE_KEYS = {
	driveBackupIndex: "tabmd:driveBackupIndex",
	installId: "tabmd:driveInstallId",
	retentionCount: "tabmd:driveRetentionCount",
} as const;

/** One Drive backup row shown in the options-page restore dialog. */
export type DriveBackupEntry = {
	fileId: string;
	fileName: string;
	timestamp: number;
	size: number;
	noteCount: number;
};

/** Cached backup metadata used to render the restore list without immediate refetches. */
export type DriveBackupIndex = {
	installId: string;
	backups: DriveBackupEntry[];
};

/** Serialized JSON content stored in each uploaded Google Drive backup file. */
export type SerializedBackupPayload = {
	version: number;
	timestamp: number;
	installId: string;
	notes: Record<string, NoteRecord>;
};

/** Minimal Drive metadata fields required for listing and retention decisions. */
export type DriveFileRecord = {
	id: string;
	name: string;
	createdTime?: string;
	modifiedTime?: string;
	size?: string;
};

/**
 * Clamps unknown retention input into a positive integer.
 * Invalid values fall back to the provided default so UI and storage stay stable.
 */
export function normalizeRetentionCount(
	value: unknown,
	fallback = DEFAULT_RETENTION_COUNT,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}

	const floored = Math.floor(value);
	if (floored < MIN_RETENTION_COUNT) {
		return MIN_RETENTION_COUNT;
	}
	if (floored > MAX_RETENTION_COUNT) {
		return MAX_RETENTION_COUNT;
	}
	return floored;
}

/** Creates the canonical backup file name with an embedded note count. */
export function createBackupFileName(
	timestamp: number,
	noteCount: number,
): string {
	return createTabmdBackupFileName(timestamp, noteCount);
}

/** Extracts the embedded note count from a Drive backup filename. */
export function extractNoteCountFromFileName(fileName: string): number {
	return extractNoteCountFromBackupFileName(fileName);
}

/** Parses a Drive timestamp field into epoch milliseconds, returning `0` on invalid input. */
export function parseDriveTimestamp(value: string | undefined): number {
	if (typeof value !== "string" || value.length === 0) {
		return 0;
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
