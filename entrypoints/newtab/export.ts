import { resolveNoteTitle } from '../shared/note_title';

export function performExport(noteTitle: string | null, content: string) {
    const resolved = resolveNoteTitle({ title: noteTitle, content });
    const sanitized = resolved.replace(/[\\/:*?"<>|]/g, '-');
    const filename = `${sanitized || 'Untitled'}.md`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
}
