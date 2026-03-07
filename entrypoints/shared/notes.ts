import { STORAGE_KEYS, type NoteRecord } from "./storage";
export type { NoteRecord };

export async function readAllNotes(): Promise<Record<string, NoteRecord>> {
	const result = await chrome.storage.local.get({ [STORAGE_KEYS.notes]: {} });
	// Ensure we always return an object even if corrupt data exists
	const notes = result[STORAGE_KEYS.notes];
	return notes && typeof notes === "object" && !Array.isArray(notes)
		? (notes as Record<string, NoteRecord>)
		: {};
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

export async function deleteNote(id: string): Promise<void> {
	const notes = await readAllNotes();
	if (notes[id]) {
		delete notes[id];
		await chrome.storage.local.set({ [STORAGE_KEYS.notes]: notes });
	}
}

export async function listNotesSorted(): Promise<NoteRecord[]> {
	const notes = await readAllNotes();
	return Object.values(notes).sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export async function listRecentNotes(limit: number): Promise<NoteRecord[]> {
	if (limit <= 0) {
		return [];
	}

	const notes = Object.values(await readAllNotes());
	if (notes.length <= limit) {
		return notes.sort((a, b) => b.modifiedAt - a.modifiedAt);
	}

	const recentNotes: NoteRecord[] = [];

	// Keep only the top `limit` notes in descending order so the popup avoids sorting the entire library.
	for (const note of notes) {
		insertRecentNote(recentNotes, note, limit);
	}

	return recentNotes;
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
