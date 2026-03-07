import { describe, expect, it } from "vitest";
import {
	buildSearchIndex,
	filterIndexedNotes,
	filterNotes,
} from "../../entrypoints/list/search";
import type { NoteRecord } from "../../entrypoints/shared/storage";

const mockNotes: NoteRecord[] = [
	{
		id: "1",
		title: "Hello World",
		content: "This is a test note.",
		createdAt: 0,
		modifiedAt: 0,
	},
	{
		id: "2",
		title: "Groceries",
		content: "Milk\nEggs\nBread",
		createdAt: 0,
		modifiedAt: 0,
	},
	{
		id: "3",
		title: null,
		content: "# Untitled Note\nSome content inside",
		createdAt: 0,
		modifiedAt: 0,
	},
];

describe("search logic", () => {
	it("returns all notes when query is empty", () => {
		const results = filterNotes(mockNotes, "");
		expect(results.length).toBe(3);
	});

	it("filters by title (case insensitive)", () => {
		const results = filterNotes(mockNotes, "hello");
		expect(results.length).toBe(1);
		expect(results[0].note.id).toBe("1");
	});

	it("filters by content", () => {
		const results = filterNotes(mockNotes, "milk");
		expect(results.length).toBe(1);
		expect(results[0].note.id).toBe("2");
	});

	it("matches derived title", () => {
		const results = filterNotes(mockNotes, "untitled");
		expect(results.length).toBe(1);
		expect(results[0].note.id).toBe("3");
	});

	it("returns no results when nothing matches", () => {
		const results = filterNotes(mockNotes, "zebra");
		expect(results.length).toBe(0);
	});

	it("extracts snippet from content when searching title", () => {
		const results = filterNotes(mockNotes, "world");
		expect(results[0].snippet).toBe("This is a test note.");
	});

	it("reuses the prebuilt search index without changing search results", () => {
		const searchIndex = buildSearchIndex(mockNotes);
		const directResults = filterNotes(mockNotes, "milk");
		const indexedResults = filterIndexedNotes(searchIndex, "milk");

		expect(indexedResults).toEqual(directResults);
	});

	it("returns a stable fallback snippet when the matching content line is blank", () => {
		const results = filterNotes(
			[
				{
					id: "4",
					title: "Blank line test",
					content: "\n\nFirst visible line\n\n",
					createdAt: 0,
					modifiedAt: 0,
				},
			],
			"blank",
		);

		expect(results[0].snippet).toBe("First visible line");
	});
});
