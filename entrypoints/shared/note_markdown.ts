import { resolveNoteTitle } from "./note_title";
import type { NoteRecord } from "./storage";

const FRONTMATTER_DELIMITER = "---";
const METADATA_VERSION = 1;

/**
 * Replaces characters that are invalid in common desktop file systems.
 * Keeping the sanitizer simple avoids surprising title rewrites beyond the
 * characters that would actually break downloads or uploads.
 */
function sanitizeFileNameSegment(value: string): string {
	return value.replace(/[\\/:*?"<>|]/g, "-").trim();
}

/** Parses one JSON-encoded frontmatter scalar while falling back safely on malformed metadata. */
function parseJsonScalar<T>(value: string | undefined, fallback: T): T {
	if (typeof value !== "string") {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

/** Builds the shared `title-<timestamp>.md` filename used by export and Drive backups. */
export function createNoteMarkdownFileName(
	noteTitle: string | null,
	content: string,
	timestampMs: number,
): string {
	const resolvedTitle = resolveNoteTitle({ title: noteTitle, content });
	const safeTitle = sanitizeFileNameSegment(resolvedTitle) || "Untitled";
	const timestampSegment = new Date(
		Number.isFinite(timestampMs) ? timestampMs : Date.now(),
	)
		.toISOString()
		.replace(/[:.]/g, "-");
	return `${safeTitle}-${timestampSegment}.md`;
}

/**
 * Serializes note metadata into Markdown frontmatter so every backup artifact
 * stays a plain `.md` file while still carrying enough information to restore
 * the original note identity and timestamps accurately.
 */
export function serializeNoteToMarkdownFile(note: NoteRecord): string {
	const metadataLines = [
		FRONTMATTER_DELIMITER,
		`tabmd-version: ${METADATA_VERSION}`,
		`tabmd-id: ${JSON.stringify(note.id)}`,
		`tabmd-title: ${JSON.stringify(note.title)}`,
		`tabmd-created-at: ${Math.floor(note.createdAt)}`,
		`tabmd-modified-at: ${Math.floor(note.modifiedAt)}`,
		FRONTMATTER_DELIMITER,
		"",
	];
	return `${metadataLines.join("\n")}${note.content}`;
}

/**
 * Parses one Markdown backup file back into a note record.
 * Files missing TabMD frontmatter are still accepted as plain Markdown notes so
 * restore can recover useful content instead of failing hard on one bad file.
 */
export function parseNoteFromMarkdownFile(
	fileContent: string,
	fallbackTimestamp = Date.now(),
): NoteRecord {
	const lines = fileContent.split(/\r?\n/);
	if (lines[0] !== FRONTMATTER_DELIMITER) {
		const timestamp = Math.floor(fallbackTimestamp);
		return {
			id: crypto.randomUUID(),
			title: null,
			content: fileContent,
			createdAt: timestamp,
			modifiedAt: timestamp,
		};
	}

	let delimiterIndex = -1;
	const rawMetadata = new Map<string, string>();
	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (line === FRONTMATTER_DELIMITER) {
			delimiterIndex = index;
			break;
		}

		const separatorIndex = line.indexOf(":");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = line.slice(0, separatorIndex).trim();
		const value = line.slice(separatorIndex + 1).trim();
		rawMetadata.set(key, value);
	}

	if (delimiterIndex === -1) {
		const timestamp = Math.floor(fallbackTimestamp);
		return {
			id: crypto.randomUUID(),
			title: null,
			content: fileContent,
			createdAt: timestamp,
			modifiedAt: timestamp,
		};
	}

	const idValue = rawMetadata.get("tabmd-id");
	const titleValue = rawMetadata.get("tabmd-title");
	const createdAtValue = Number(rawMetadata.get("tabmd-created-at"));
	const modifiedAtValue = Number(rawMetadata.get("tabmd-modified-at"));
	const contentStartIndex =
		lines[delimiterIndex + 1] === "" ? delimiterIndex + 2 : delimiterIndex + 1;
	const content = lines.slice(contentStartIndex).join("\n");
	const fallback = Math.floor(fallbackTimestamp);

	return {
		id:
			parseJsonScalar<string | null>(idValue, crypto.randomUUID()) ??
			crypto.randomUUID(),
		title: parseJsonScalar<string | null>(titleValue, null),
		content,
		createdAt:
			Number.isFinite(createdAtValue) && createdAtValue > 0
				? Math.floor(createdAtValue)
				: fallback,
		modifiedAt:
			Number.isFinite(modifiedAtValue) && modifiedAtValue > 0
				? Math.floor(modifiedAtValue)
				: fallback,
	};
}
