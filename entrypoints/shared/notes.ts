import { normalizeNotesRecord, STORAGE_KEYS, type NoteRecord } from "./storage";
export type { NoteRecord };
export type NotesListener = (notes: Record<string, NoteRecord>) => void;

export async function readAllNotes(): Promise<Record<string, NoteRecord>> {
	const result = await chrome.storage.local.get({ [STORAGE_KEYS.notes]: {} });
	// Every read funnels through normalization so callers never need to defend against corrupt storage shapes.
	return normalizeNotesRecord(result[STORAGE_KEYS.notes]);
}

export async function readNote(id: string): Promise<NoteRecord | null> {
	const notes = await readAllNotes();
	return notes[id] || null;
}

export async function writeNote(note: NoteRecord): Promise<void> {
	const notes = await readAllNotes();
	notes[note.id] = note;
	await chrome.storage.local.set({ [STORAGE_KEYS.notes]: notes });
}

/**
 * Replaces the entire note dictionary with a normalized snapshot.
 * Restore flows use this to overwrite local state atomically with backup contents.
 */
export async function writeAllNotes(
	notes: Record<string, NoteRecord>,
): Promise<Record<string, NoteRecord>> {
	const normalized = normalizeNotesRecord(notes);
	await chrome.storage.local.set({ [STORAGE_KEYS.notes]: normalized });
	return normalized;
}

export async function deleteNote(id: string): Promise<void> {
	const notes = await readAllNotes();
	if (notes[id]) {
		delete notes[id];
		await chrome.storage.local.set({ [STORAGE_KEYS.notes]: notes });
	}
}

export async function listNotesSorted(): Promise<NoteRecord[]> {
	return sortNotesByModifiedDesc(Object.values(await readAllNotes()));
}

export async function listRecentNotes(limit: number): Promise<NoteRecord[]> {
	return selectRecentNotes(Object.values(await readAllNotes()), limit);
}

/**
 * Returns notes in descending modification order so every UI surface uses the same primary sort semantics.
 */
export function sortNotesByModifiedDesc(
	notes: Iterable<NoteRecord>,
): NoteRecord[] {
	return [...notes].sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/**
 * Keeps only the most recent `limit` notes without sorting the entire input when callers need a small cap.
 * Popup refreshes reuse this helper directly on storage snapshots to stay O(n * limit) instead of O(n log n).
 */
export function selectRecentNotes(
	notes: Iterable<NoteRecord>,
	limit: number,
): NoteRecord[] {
	if (limit <= 0) {
		return [];
	}

	const allNotes = [...notes];
	if (allNotes.length <= limit) {
		return sortNotesByModifiedDesc(allNotes);
	}

	const recentNotes: NoteRecord[] = [];

	// Keep only the top `limit` notes in descending order so the popup avoids sorting the entire library.
	for (const note of allNotes) {
		insertRecentNote(recentNotes, note, limit);
	}

	return recentNotes;
}

/**
 * Streams normalized note snapshots to UI surfaces as soon as storage changes land.
 * Reusing the storage event payload avoids an extra read and keeps popup/list refresh work bounded.
 */
export function subscribeToNotes(listener: NotesListener): () => void {
	const handleStorageChange = (
		changes: Record<string, chrome.storage.StorageChange>,
		areaName: string,
	): void => {
		if (areaName !== "local" || !(STORAGE_KEYS.notes in changes)) {
			return;
		}

		listener(normalizeNotesRecord(changes[STORAGE_KEYS.notes]?.newValue));
	};

	chrome.storage.onChanged.addListener(handleStorageChange);

	return () => {
		chrome.storage.onChanged.removeListener(handleStorageChange);
	};
}

function insertRecentNote(
	recentNotes: NoteRecord[],
	nextNote: NoteRecord,
	limit: number,
): void {
	let insertAt = recentNotes.length;

	for (let index = 0; index < recentNotes.length; index += 1) {
		if (nextNote.modifiedAt > recentNotes[index].modifiedAt) {
			insertAt = index;
			break;
		}
	}

	if (insertAt === recentNotes.length && recentNotes.length >= limit) {
		return;
	}

	recentNotes.splice(insertAt, 0, nextNote);

	if (recentNotes.length > limit) {
		recentNotes.pop();
	}
}
