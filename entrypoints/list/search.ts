import type { NoteRecord } from "../shared/storage";
import { resolveNoteTitle } from "../shared/note_title";

export type SearchResult = {
	note: NoteRecord;
	title: string;
	snippet: string;
};

export type SearchIndexEntry = {
	note: NoteRecord;
	title: string;
	normalizedTitle: string;
	normalizedContent: string;
	defaultSnippet: string;
};

const EMPTY_NOTE_SNIPPET = "Empty note";
const MAX_SNIPPET_LENGTH = 100;

export function filterNotes(
	notes: NoteRecord[],
	query: string,
): SearchResult[] {
	return filterIndexedNotes(buildSearchIndex(notes), query);
}

export function buildSearchIndex(notes: NoteRecord[]): SearchIndexEntry[] {
	return notes.map((note) => {
		const title = resolveNoteTitle(note);
		return {
			note,
			title,
			normalizedTitle: title.toLowerCase(),
			normalizedContent: note.content.toLowerCase(),
			// Cache the default snippet once so repeated searches do not rescan the same note content.
			defaultSnippet: getDefaultSnippet(note.content),
		};
	});
}

export function filterIndexedNotes(
	index: SearchIndexEntry[],
	query: string,
): SearchResult[] {
	const normalizedQuery = query.trim().toLowerCase();
	const results: SearchResult[] = [];

	for (const entry of index) {
		if (normalizedQuery === "") {
			results.push(createSearchResult(entry, entry.defaultSnippet));
			continue;
		}

		if (entry.normalizedTitle.includes(normalizedQuery)) {
			results.push(createSearchResult(entry, entry.defaultSnippet));
			continue;
		}

		if (entry.normalizedContent.includes(normalizedQuery)) {
			results.push(
				createSearchResult(
					entry,
					getBestSnippet(
						entry.note.content,
						normalizedQuery,
						entry.defaultSnippet,
					),
				),
			);
		}
	}

	return results;
}

function createSearchResult(
	entry: SearchIndexEntry,
	snippet: string,
): SearchResult {
	return {
		note: entry.note,
		title: entry.title,
		snippet,
	};
}

function getDefaultSnippet(content: string): string {
	const firstNonEmptyLine = findMatchingLine(content, null);
	return firstNonEmptyLine ?? EMPTY_NOTE_SNIPPET;
}

function getBestSnippet(
	content: string,
	normalizedQuery: string,
	fallbackSnippet: string,
): string {
	const matchingLine = findMatchingLine(content, normalizedQuery);
	if (matchingLine) {
		return matchingLine;
	}

	return fallbackSnippet;
}

function findMatchingLine(
	content: string,
	normalizedQuery: string | null,
): string | null {
	let lineStart = 0;

	for (let index = 0; index <= content.length; index += 1) {
		if (index !== content.length && content[index] !== "\n") {
			continue;
		}

		const trimmedLine = content.slice(lineStart, index).trim();
		lineStart = index + 1;

		if (trimmedLine.length === 0) {
			continue;
		}

		if (
			normalizedQuery === null ||
			trimmedLine.toLowerCase().includes(normalizedQuery)
		) {
			return trimmedLine.slice(0, MAX_SNIPPET_LENGTH);
		}
	}

	return null;
}
