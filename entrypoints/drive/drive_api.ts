/**
 * Minimal Google Drive REST client used by the backup feature.
 * Each function is stateless and accepts an OAuth token explicitly so unit tests
 * can mock network calls without needing extension runtime state.
 */
import type { DriveFileRecord } from "./types";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** One paginated file-list response page. */
export type DriveListFilesPage = {
	files: DriveFileRecord[];
	nextPageToken: string | null;
};

/** Escapes literals embedded inside Drive query strings. */
function escapeDriveQueryLiteral(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Builds the shared authorization headers for Drive REST calls. */
function buildAuthHeaders(
	token: string,
	extra?: Record<string, string>,
): Headers {
	return new Headers({
		Authorization: `Bearer ${token}`,
		...(extra ?? {}),
	});
}

/**
 * Parses a Drive JSON response and turns non-success responses into actionable errors.
 * Including the HTTP status makes auth and quota failures much easier to debug.
 */
async function parseJsonResponse<T>(
	response: Response,
	context: string,
): Promise<T> {
	if (!response.ok) {
		let details = "";
		try {
			details = await response.text();
		} catch {
			details = "";
		}

		throw new Error(
			`${context} failed (${response.status}): ${details}`.trim(),
		);
	}

	return (await response.json()) as T;
}

/**
 * Lists every file in a Drive folder by following page tokens until exhausted.
 * The ordering is newest-first because backup filenames contain sortable timestamps.
 */
export async function listFiles(
	folderId: string,
	token: string,
): Promise<DriveFileRecord[]> {
	const allFiles: DriveFileRecord[] = [];
	let nextPageToken: string | null = null;

	do {
		const page = await listFilesPage(
			folderId,
			token,
			nextPageToken ?? undefined,
		);
		allFiles.push(...page.files);
		nextPageToken = page.nextPageToken;
	} while (nextPageToken);

	return allFiles;
}

/** Lists one page of files in a Drive folder for demand-driven restore pagination. */
export async function listFilesPage(
	folderId: string,
	token: string,
	pageToken?: string,
	pageSize = 200,
): Promise<DriveListFilesPage> {
	const query = [
		`'${escapeDriveQueryLiteral(folderId)}' in parents`,
		"trashed = false",
	].join(" and ");
	const params = new URLSearchParams({
		q: query,
		orderBy: "name desc",
		pageSize: String(pageSize),
		fields: "nextPageToken,files(id,name,createdTime,modifiedTime,size)",
		supportsAllDrives: "false",
	});

	if (typeof pageToken === "string" && pageToken.length > 0) {
		params.set("pageToken", pageToken);
	}

	const response = await fetch(`${DRIVE_API_BASE}/files?${params.toString()}`, {
		method: "GET",
		headers: buildAuthHeaders(token),
	});

	const data = await parseJsonResponse<{
		files?: DriveFileRecord[];
		nextPageToken?: string;
	}>(response, "Drive list files");

	return {
		files: Array.isArray(data.files) ? data.files : [],
		nextPageToken:
			typeof data.nextPageToken === "string" && data.nextPageToken.length > 0
				? data.nextPageToken
				: null,
	};
}

/**
 * Finds an existing folder by name and optional parent, or creates it if absent.
 * Backup code uses this twice to resolve `tabmd_backups/<installId>`.
 */
export async function getOrCreateFolder(
	name: string,
	token: string,
	parentId?: string,
): Promise<string> {
	const clauses = [
		`name = '${escapeDriveQueryLiteral(name)}'`,
		`mimeType = '${DRIVE_FOLDER_MIME}'`,
		"trashed = false",
	];

	if (typeof parentId === "string" && parentId.length > 0) {
		clauses.push(`'${escapeDriveQueryLiteral(parentId)}' in parents`);
	}

	const params = new URLSearchParams({
		q: clauses.join(" and "),
		orderBy: "createdTime desc",
		pageSize: "1",
		fields: "files(id,name)",
		supportsAllDrives: "false",
	});

	const listResponse = await fetch(
		`${DRIVE_API_BASE}/files?${params.toString()}`,
		{
			method: "GET",
			headers: buildAuthHeaders(token),
		},
	);
	const listed = await parseJsonResponse<{ files?: Array<{ id?: string }> }>(
		listResponse,
		"Drive find folder",
	);
	const existingId = listed.files?.[0]?.id;
	if (typeof existingId === "string" && existingId.length > 0) {
		return existingId;
	}

	const payload: {
		name: string;
		mimeType: string;
		parents?: string[];
	} = {
		name,
		mimeType: DRIVE_FOLDER_MIME,
	};

	if (typeof parentId === "string" && parentId.length > 0) {
		payload.parents = [parentId];
	}

	const createResponse = await fetch(
		`${DRIVE_API_BASE}/files?supportsAllDrives=false`,
		{
			method: "POST",
			headers: buildAuthHeaders(token, { "Content-Type": "application/json" }),
			body: JSON.stringify(payload),
		},
	);
	const created = await parseJsonResponse<{ id?: string }>(
		createResponse,
		"Drive create folder",
	);

	if (typeof created.id !== "string" || created.id.length === 0) {
		throw new Error("Drive create folder returned no folder ID.");
	}

	return created.id;
}

/**
 * Uploads a text file using Drive's multipart upload endpoint and returns the created metadata.
 * The boundary uses a UUID so concurrent uploads never collide.
 */
export async function uploadTextFile(
	name: string,
	content: string,
	mimeType: string,
	folderId: string,
	token: string,
): Promise<DriveFileRecord> {
	const boundary = `tabmd-${crypto.randomUUID()}`;
	const metadata = {
		name,
		mimeType,
		parents: [folderId],
	};

	const body = [
		`--${boundary}`,
		"Content-Type: application/json; charset=UTF-8",
		"",
		JSON.stringify(metadata),
		`--${boundary}`,
		`Content-Type: ${mimeType}; charset=UTF-8`,
		"",
		content,
		`--${boundary}--`,
		"",
	].join("\r\n");

	const response = await fetch(
		`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,createdTime,modifiedTime,size&supportsAllDrives=false`,
		{
			method: "POST",
			headers: buildAuthHeaders(token, {
				"Content-Type": `multipart/related; boundary=${boundary}`,
			}),
			body,
		},
	);

	const created = await parseJsonResponse<DriveFileRecord>(
		response,
		"Drive upload file",
	);
	if (typeof created.id !== "string" || created.id.length === 0) {
		throw new Error("Drive upload file returned no file ID.");
	}
	if (typeof created.name !== "string" || created.name.length === 0) {
		throw new Error("Drive upload file returned no file name.");
	}

	return created;
}

/** Downloads one text file from Drive using `alt=media`. */
export async function downloadTextFile(
	fileId: string,
	token: string,
): Promise<string> {
	const response = await fetch(
		`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
		{
			method: "GET",
			headers: buildAuthHeaders(token),
		},
	);

	if (!response.ok) {
		let details = "";
		try {
			details = await response.text();
		} catch {
			details = "";
		}

		throw new Error(
			`Drive download file failed (${response.status}): ${details}`.trim(),
		);
	}

	return response.text();
}
/**
 * Deletes a Drive file by ID.
 * `404` is treated as success so retention and manual delete stay idempotent.
 */
export async function deleteFile(fileId: string, token: string): Promise<void> {
	const response = await fetch(
		`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?supportsAllDrives=false`,
		{
			method: "DELETE",
			headers: buildAuthHeaders(token),
		},
	);

	if (!response.ok && response.status !== 404) {
		let details = "";
		try {
			details = await response.text();
		} catch {
			details = "";
		}

		throw new Error(
			`Drive delete file failed (${response.status}): ${details}`.trim(),
		);
	}
}
