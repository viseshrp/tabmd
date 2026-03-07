import type { NoteRecord } from '../shared/storage';
import { resolveNoteTitle } from '../shared/note_title';

export type SearchResult = {
    note: NoteRecord;
    title: string;
    snippet: string;
};

export function filterNotes(notes: NoteRecord[], query: string): SearchResult[] {
    const normQuery = query.trim().toLowerCase();

    const results: SearchResult[] = [];

    for (const note of notes) {
        const title = resolveNoteTitle(note);
        const normTitle = title.toLowerCase();
        const normContent = note.content.toLowerCase();

        if (normQuery === '') {
            // Empty query -> show all, with a basic snippet
            results.push({
                note,
                title,
                snippet: getBestSnippet(note.content, '')
            });
            continue;
        }

        // Match in title
        if (normTitle.includes(normQuery)) {
            results.push({
                note,
                title,
                snippet: getBestSnippet(note.content, '')
            });
            continue;
        }

        // Match in content
        if (normContent.includes(normQuery)) {
            results.push({
                note,
                title,
                snippet: getBestSnippet(note.content, normQuery)
            });
            continue;
        }
    }

    return results;
}

function getBestSnippet(content: string, query: string): string {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) return 'Empty note';

    if (!query) {
        // If no query or title match, return first non-empty line (that isn't a heading if possible)
        // Or just the first line
        return lines[0].substring(0, 100);
    }

    // Find line with query
    const matchLine = lines.find(l => l.toLowerCase().includes(query));
    if (matchLine) {
        return matchLine.substring(0, 100);
    }

    return lines[0].substring(0, 100);
}
