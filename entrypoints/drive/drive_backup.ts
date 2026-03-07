/**
 * Drive backup orchestration for TabMD:
 * serialize local data, upload/list/delete Drive files, maintain a local backup index,
 * and restore a backup snapshot back into local storage.
 */
import { normalizeNotesRecord, type NoteRecord } from "../shared/storage";
import { readAllNotes, writeAllNotes } from "../shared/notes";
import { logExtensionError, runWithConcurrency } from "../shared/utils";
import {
	deleteFile,
	downloadJsonFile,
	getOrCreateFolder,
	listFiles,
	listFilesPage,
	uploadJsonFile,
	type DriveListFilesPage,
} from "./drive_api";
import {
	BACKUP_VERSION,
	DEFAULT_RETENTION_COUNT,
	DRIVE_FOLDER_NAME,
	DRIVE_STORAGE_KEYS,
	createBackupFileName,
	extractNoteCountFromFileName,
	normalizeRetentionCount,
	parseDriveTimestamp,
	type DriveBackupEntry,
	type DriveBackupIndex,
	type DriveFileRecord,
	type SerializedBackupPayload,
} from "./types";

/** Drive REST dependencies are injected so orchestration can stay unit-testable. */
type DriveApiDeps = {
	getOrCreateFolder: typeof getOrCreateFolder;
	listFiles: typeof listFiles;
	listFilesPage?: typeof listFilesPage;
	uploadJsonFile: typeof uploadJsonFile;
	downloadJsonFile: typeof downloadJsonFile;
	deleteFile: typeof deleteFile;
};

/** Production dependency bag that uses the real Drive REST implementation. */
const defaultDeps: DriveApiDeps = {
	getOrCreateFolder,
	listFiles,
	listFilesPage,
	uploadJsonFile,
	downloadJsonFile,
	deleteFile,
};

/** Retention deletes run with a small concurrency cap to avoid unbounded request bursts. */
const RETENTION_DELETE_CONCURRENCY = 4;

/**
 * Converts raw Drive file metadata into normalized backup rows.
 * Sorting newest-first keeps the options dialog and retention logic aligned.
 */
function toBackupEntries(files: DriveFileRecord[]): DriveBackupEntry[] {
	const entries = files
		.filter((file) => typeof file.id === "string" && file.id.length > 0)
		.map((file) => {
			const timestamp =
				parseDriveTimestamp(file.createdTime) ||
				parseDriveTimestamp(file.modifiedTime) ||
				Date.now();
			const parsedSize = Number(file.size);

			return {
				fileId: file.id,
				fileName: typeof file.name === "string" ? file.name : "backup.json",
				timestamp,
				size: Number.isFinite(parsedSize) && parsedSize > 0 ? parsedSize : 0,
				noteCount: extractNoteCountFromFileName(
					typeof file.name === "string" ? file.name : "",
				),
			};
		});

	entries.sort((left, right) => {
		if (right.timestamp !== left.timestamp) {
			return right.timestamp - left.timestamp;
		}
		return left.fileName.localeCompare(right.fileName);
	});

	return entries;
}

/** Reads or creates the install ID that scopes backups to one extension install. */
export async function getOrCreateInstallId(): Promise<string> {
	const raw = await chrome.storage.local.get([DRIVE_STORAGE_KEYS.installId]);
	const existing = raw[DRIVE_STORAGE_KEYS.installId];
	if (typeof existing === "string" && existing.length > 0) {
		return existing;
	}

	const created = crypto.randomUUID();
	await chrome.storage.local.set({ [DRIVE_STORAGE_KEYS.installId]: created });
	return created;
}

/** Creates the JSON payload that is uploaded into Drive for one backup snapshot. */
export function serializeBackup(
	notes: Record<string, NoteRecord>,
	installId: string,
	timestamp = Date.now(),
): SerializedBackupPayload {
	return {
		version: BACKUP_VERSION,
		timestamp,
		installId,
		notes,
	};
}

/** Reads the stored retention count, normalizing corrupt or missing values back to defaults. */
export async function readRetentionCount(): Promise<number> {
	const raw = await chrome.storage.local.get([
		DRIVE_STORAGE_KEYS.retentionCount,
	]);
	return normalizeRetentionCount(
		raw[DRIVE_STORAGE_KEYS.retentionCount],
		DEFAULT_RETENTION_COUNT,
	);
}

/** Writes the normalized retention count and returns the stored value. */
export async function writeRetentionCount(
	retentionCount: number,
): Promise<number> {
	const normalized = normalizeRetentionCount(
		retentionCount,
		DEFAULT_RETENTION_COUNT,
	);
	await chrome.storage.local.set({
		[DRIVE_STORAGE_KEYS.retentionCount]: normalized,
	});
	return normalized;
}

/**
 * Reads the locally cached Drive backup index.
 * UI callers always receive a stable `{ installId, backups }` shape even when storage is malformed.
 */
export async function readLocalIndex(): Promise<DriveBackupIndex> {
	const raw = await chrome.storage.local.get([
		DRIVE_STORAGE_KEYS.driveBackupIndex,
		DRIVE_STORAGE_KEYS.installId,
	]);
	const rawInstallId = raw[DRIVE_STORAGE_KEYS.installId];
	const installId =
		typeof rawInstallId === "string" && rawInstallId.length > 0
			? rawInstallId
			: "";

	const fallback: DriveBackupIndex = { installId, backups: [] };
	const index = raw[DRIVE_STORAGE_KEYS.driveBackupIndex];
	if (!index || typeof index !== "object") {
		return fallback;
	}

	const maybeInstallId = (index as { installId?: unknown }).installId;
	const maybeBackups = (index as { backups?: unknown }).backups;
	if (typeof maybeInstallId !== "string" || !Array.isArray(maybeBackups)) {
		return fallback;
	}

	const normalizedBackups = maybeBackups
		.filter((entry): entry is DriveBackupEntry =>
			Boolean(entry && typeof entry === "object"),
		)
		.map((entry) => {
			const fileId = typeof entry.fileId === "string" ? entry.fileId : "";
			const fileName =
				typeof entry.fileName === "string" ? entry.fileName : "backup.json";
			const timestamp =
				typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp)
					? Math.floor(entry.timestamp)
					: Date.now();
			const size =
				typeof entry.size === "number" && Number.isFinite(entry.size)
					? Math.max(0, Math.floor(entry.size))
					: 0;
			const noteCount =
				typeof entry.noteCount === "number" && Number.isFinite(entry.noteCount)
					? Math.max(0, Math.floor(entry.noteCount))
					: extractNoteCountFromFileName(fileName);

			return { fileId, fileName, timestamp, size, noteCount };
		})
		.filter((entry) => entry.fileId.length > 0)
		.sort((left, right) => right.timestamp - left.timestamp);

	return {
		installId: maybeInstallId,
		backups: normalizedBackups,
	};
}

/** Writes a normalized backup index snapshot for quick options-page rendering. */
export async function updateLocalIndex(
	installId: string,
	backups: DriveBackupEntry[],
): Promise<void> {
	const next: DriveBackupIndex = {
		installId,
		backups: backups
			.filter((entry) => entry.fileId.length > 0)
			.map((entry) => ({
				fileId: entry.fileId,
				fileName: entry.fileName,
				timestamp: Math.floor(entry.timestamp),
				size: Math.max(0, Math.floor(entry.size)),
				noteCount: Math.max(0, Math.floor(entry.noteCount)),
			}))
			.sort((left, right) => right.timestamp - left.timestamp),
	};

	await chrome.storage.local.set({
		[DRIVE_STORAGE_KEYS.driveBackupIndex]: next,
	});
}

/** Resolves `tabmd_backups/<installId>` and returns the install folder ID. */
async function getInstallFolderId(
	installId: string,
	token: string,
	deps: Pick<DriveApiDeps, "getOrCreateFolder">,
): Promise<string> {
	const rootFolderId = await deps.getOrCreateFolder(DRIVE_FOLDER_NAME, token);
	return deps.getOrCreateFolder(installId, token, rootFolderId);
}

/**
 * Deletes old backup files beyond the configured retention limit.
 * The sort and slice are linearithmic in the number of backups, which is bounded by retention policy.
 */
export async function enforceRetention(
	installFolderId: string,
	retentionCount: number,
	token: string,
	deps: Pick<DriveApiDeps, "listFiles" | "deleteFile"> = defaultDeps,
): Promise<DriveBackupEntry[]> {
	const normalizedRetention = normalizeRetentionCount(
		retentionCount,
		DEFAULT_RETENTION_COUNT,
	);
	const files = await deps.listFiles(installFolderId, token);
	const entries = toBackupEntries(files);
	if (entries.length <= normalizedRetention) {
		return entries;
	}

	const stale = entries.slice(normalizedRetention);
	await runWithConcurrency(
		stale,
		RETENTION_DELETE_CONCURRENCY,
		async (entry) => {
			await deps.deleteFile(entry.fileId, token);
		},
	);

	return entries.slice(0, normalizedRetention);
}

/** Lists all backups for the current install and refreshes the local metadata cache. */
export async function listDriveBackups(
	token: string,
	deps: DriveApiDeps = defaultDeps,
): Promise<DriveBackupEntry[]> {
	const installId = await getOrCreateInstallId();
	const installFolderId = await getInstallFolderId(installId, token, deps);
	const files = await deps.listFiles(installFolderId, token);
	const backups = toBackupEntries(files);
	await updateLocalIndex(installId, backups);
	return backups;
}

/** One page of restore-list metadata shown in the options dialog. */
export type DriveBackupListPage = {
	backups: DriveBackupEntry[];
	nextPageToken: string | null;
};

/**
 * Lists one page of backup metadata for the restore dialog.
 * Only file metadata is returned here; the full JSON payload is downloaded only on restore.
 */
export async function listDriveBackupsPage(
	token: string,
	pageToken?: string,
	pageSize = 25,
	deps: Pick<
		DriveApiDeps,
		"getOrCreateFolder" | "listFilesPage" | "listFiles"
	> = defaultDeps,
): Promise<DriveBackupListPage> {
	const installId = await getOrCreateInstallId();
	const installFolderId = await getInstallFolderId(installId, token, deps);
	const page: DriveListFilesPage =
		typeof deps.listFilesPage === "function"
			? await deps.listFilesPage(installFolderId, token, pageToken, pageSize)
			: pageToken
				? { files: [], nextPageToken: null }
				: {
						files: await deps.listFiles(installFolderId, token),
						nextPageToken: null,
					};

	return {
		backups: toBackupEntries(page.files),
		nextPageToken: page.nextPageToken,
	};
}

/**
 * Performs a manual backup:
 * read local data, upload a JSON snapshot, enforce retention, refresh the local index,
 * and persist the normalized retention setting that was used.
 */
export async function performBackup(
	token: string,
	requestedRetentionCount?: number,
	deps: DriveApiDeps = defaultDeps,
	preloaded?: {
		notes?: Record<string, NoteRecord>;
	},
): Promise<DriveBackupEntry[]> {
	const installId = await getOrCreateInstallId();
	const notes = preloaded?.notes ?? (await readAllNotes());

	const timestamp = Date.now();
	const payload = serializeBackup(notes, installId, timestamp);
	const content = JSON.stringify(payload, null, 2);

	const installFolderId = await getInstallFolderId(installId, token, deps);
	const noteCount = Object.keys(notes).length;
	const fileName = createBackupFileName(timestamp, noteCount);
	await deps.uploadJsonFile(fileName, content, installFolderId, token);

	const retention =
		typeof requestedRetentionCount === "number"
			? normalizeRetentionCount(
					requestedRetentionCount,
					DEFAULT_RETENTION_COUNT,
				)
			: await readRetentionCount();
	const backups = await enforceRetention(
		installFolderId,
		retention,
		token,
		deps,
	);

	await updateLocalIndex(installId, backups);
	await writeRetentionCount(retention);
	return backups;
}

/**
 * Downloads a backup payload, validates it, then overwrites local notes.
 * The note dictionary is normalized before write so malformed entries are silently dropped.
 */
export async function restoreFromBackup(
	fileId: string,
	token: string,
	deps: Pick<DriveApiDeps, "downloadJsonFile"> = defaultDeps,
): Promise<{ restoredNotes: number }> {
	const rawPayload = await deps.downloadJsonFile(fileId, token);
	if (!rawPayload || typeof rawPayload !== "object") {
		throw new Error("Backup payload is not an object.");
	}

	const notesRaw = (rawPayload as { notes?: unknown }).notes;
	const notes = normalizeNotesRecord(notesRaw);

	await writeAllNotes(notes);

	return { restoredNotes: Object.keys(notes).length };
}

/**
 * Returns cached backup metadata when available and falls back to a Drive refetch otherwise.
 * The fallback keeps the restore UI usable even if the local index is missing or corrupt.
 */
export async function getBackupsWithFallback(
	token: string,
	deps: DriveApiDeps = defaultDeps,
): Promise<DriveBackupEntry[]> {
	const local = await readLocalIndex();
	if (local.backups.length > 0) {
		return local.backups;
	}

	try {
		return await listDriveBackups(token, deps);
	} catch (error) {
		logExtensionError("Failed to list Drive backups as fallback", error, {
			operation: "runtime_context",
		});
		return [];
	}
}
