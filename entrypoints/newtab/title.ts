import { resolveNoteTitle } from '../shared/note_title';
import { updateNoteTitle } from './save';
import { getEditorContent } from './editor';

export function initTitleActions(initialTitle: string | null, initialContent: string) {
    const display = document.getElementById('note-title-display') as HTMLHeadingElement;
    const input = document.getElementById('note-title-input') as HTMLInputElement;

    if (!display || !input) return;

    // Sync initial state
    syncTitleDisplay(initialTitle, initialContent);

    display.addEventListener('click', () => {
        // Revealing the input field
        display.hidden = true;
        input.hidden = false;
        input.value = getTitleForEditing(initialTitle);
        input.focus();
    });

    input.addEventListener('blur', () => {
        commitTitle(input, display);
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            input.blur();
        }
        if (e.key === 'Escape') {
            // Revert modifications
            input.value = getTitleForEditing(initialTitle);
            input.blur();
        }
    });
}

function getTitleForEditing(titleObjState: string | null): string {
    return titleObjState ?? '';
}

function commitTitle(input: HTMLInputElement, display: HTMLHeadingElement) {
    const raw = input.value;
    const newTitle = raw.trim() === '' ? null : raw.trim();

    // Update internal model
    updateNoteTitle(newTitle);

    // Return to display Mode
    input.hidden = true;
    display.hidden = false;

    // Visual sync
    syncTitleDisplay(newTitle, getEditorContent());
}

export function syncTitleDisplay(title: string | null, content: string) {
    const display = document.getElementById('note-title-display') as HTMLHeadingElement;
    if (!display) return;
    display.textContent = resolveNoteTitle({ title, content });
}
