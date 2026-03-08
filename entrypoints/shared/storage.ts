export type ThemeMode = "os" | "light" | "dark";

export type TabmdSettings = {
	theme: ThemeMode;
};

export type NoteRecord = {
	id: string; // UUID v4
	content: string; // Raw Markdown
	title: string | null; // null = use first-line derivation
	createdAt: number; // Unix ms
	modifiedAt: number; // Unix ms
};

export const STORAGE_KEYS = {
	settings: "tabmd:settings",
	notes: "tabmd:notes",
} as const;

export const DEFAULT_SETTINGS: TabmdSettings = {
	theme: "os",
};

export function normalizeSettings(value: unknown): TabmdSettings {
	if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
	const raw = value as Partial<TabmdSettings>;
	return {
		theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "os",
	};
}

/**
 * Normalizes one note record coming from storage or a backup payload.
 * The object-map key is treated as the canonical note ID so lookups stay consistent.
 */
export function normalizeNoteRecord(
	noteId: string,
	value: unknown,
): NoteRecord | null {
	if (typeof noteId !== "string" || noteId.length === 0) {
		return null;
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const raw = value as Partial<NoteRecord>;
	const createdAt = Number.isFinite(raw.createdAt)
		? Math.max(0, Math.floor(raw.createdAt as number))
		: 0;
	const modifiedAtCandidate = Number.isFinite(raw.modifiedAt)
		? Math.max(0, Math.floor(raw.modifiedAt as number))
		: createdAt;

	return {
		id: noteId,
		content: typeof raw.content === "string" ? raw.content : "",
		title: typeof raw.title === "string" ? raw.title : null,
		createdAt,
		// `modifiedAt` must never be older than `createdAt`, otherwise sort order becomes misleading.
		modifiedAt: Math.max(createdAt, modifiedAtCandidate),
	};
}

/**
 * Normalizes the persisted note dictionary into a safe object map keyed by note ID.
 * This keeps storage reads and backup restores resilient to malformed entries.
 */
export function normalizeNotesRecord(
	value: unknown,
): Record<string, NoteRecord> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const normalizedEntries = Object.entries(value).flatMap(
		([noteId, rawRecord]) => {
			const normalized = normalizeNoteRecord(noteId, rawRecord);
			return normalized ? [[noteId, normalized] as const] : [];
		},
	);

	return Object.fromEntries(normalizedEntries);
}

export async function readSettings(): Promise<TabmdSettings> {
	const result = await chrome.storage.local.get({
		[STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
	});
	return normalizeSettings(result[STORAGE_KEYS.settings]);
}

export async function writeSettings(settings: TabmdSettings): Promise<void> {
	await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}
