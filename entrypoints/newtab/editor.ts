import EasyMDE from 'easymde';
import 'easymde/dist/easymde.min.css';

let editorInstance: EasyMDE | null = null;
let container: HTMLElement | null = null;

export function initEditor(initialContent: string): EasyMDE {
    const textarea = document.getElementById('editor-textarea') as HTMLTextAreaElement;
    container = document.getElementById('editor-container');

    editorInstance = new EasyMDE({
        element: textarea,
        initialValue: initialContent,
        autofocus: true,
        placeholder: 'Start writing…',
        spellChecker: false,
        toolbar: false,
        status: false,
        shortcuts: {
            toggleFullScreen: null // We trigger this manually via our own button
        }
    });

    return editorInstance;
}

export function getEditorContent(): string {
    if (!editorInstance) return '';
    return editorInstance.value();
}

export function toggleFocusMode(): void {
    if (editorInstance) {
        EasyMDE.toggleFullScreen(editorInstance);
    }
}

export function hideEditor(): void {
    if (container) container.hidden = true;
}

export function showEditor(): void {
    if (container) container.hidden = false;
}
