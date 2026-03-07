export function resolveNoteTitle(note: { title: string | null; content: string }): string {
    if (note.title && note.title.trim().length > 0) {
        return note.title.trim();
    }

    const lines = note.content.split('\n');
    const firstLine = lines.length > 0 ? lines[0] : '';

    // Strip leading '#' characters and whitespace
    const stripped = firstLine.replace(/^[#\s]+/, '').trim();

    if (stripped.length > 0) {
        return stripped;
    }

    return 'Untitled';
}
