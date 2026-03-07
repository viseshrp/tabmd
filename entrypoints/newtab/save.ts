import { getEditorContent } from './editor';
import { readNote, writeNote, type NoteRecord } from '../shared/notes';
import { logExtensionError } from '../shared/utils';

let currentNote: NoteRecord | null = null;
let lastSavedContentStr: string | null = null;

export function initSaveTracking(initialNote: NoteRecord) {
    currentNote = initialNote;
    lastSavedContentStr = initialNote.content;

    // Save on visibility lost
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            void performSave();
        }
    });

    // Save on unmount / crash fallback
    window.addEventListener('beforeunload', () => {
        void performSave();
    });
}

// Ensure the local 'currentNote' object receives title updates from the UI
export function updateNoteTitle(title: string | null) {
    if (currentNote) {
        currentNote.title = title;
    }
}

async function performSave(): Promise<void> {
    if (!currentNote) return;

    const currentContent = getEditorContent();
    if (currentContent === lastSavedContentStr) {
        // Content unchanged
        // Re-check title change
        const storedNote = await readNote(currentNote.id);
        if (storedNote && storedNote.title === currentNote.title) {
            return;
        }
    }

    try {
        const updatedNote: NoteRecord = {
            ...currentNote,
            content: currentContent,
            modifiedAt: Date.now()
        };
        await writeNote(updatedNote);
        lastSavedContentStr = currentContent;
        currentNote = updatedNote;
    } catch (err: unknown) {
        logExtensionError('Failed to save note on blur', err, 'save_logic');
    }
}
