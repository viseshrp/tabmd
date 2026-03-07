import { STORAGE_KEYS, type NoteRecord } from './storage';
export type { NoteRecord };

export async function readAllNotes(): Promise<Record<string, NoteRecord>> {
    const result = await chrome.storage.local.get({ [STORAGE_KEYS.notes]: {} });
    // Ensure we always return an object even if corrupt data exists
    const notes = result[STORAGE_KEYS.notes];
    return (notes && typeof notes === 'object' && !Array.isArray(notes)) ? (notes as Record<string, NoteRecord>) : {};
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
