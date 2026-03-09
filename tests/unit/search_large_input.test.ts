import { describe, expect, it } from "vitest";
import {
	buildSearchIndex,
	filterIndexedNotes,
} from "../../entrypoints/list/search";
import type { NoteRecord } from "../../entrypoints/shared/storage";

describe("search logic with large notes", () => {
	it("normalizes note bodies lazily so title-only work avoids copying large content", () => {
		const notes: NoteRecord[] = [
			{
				id: "large-1",
				title: "Architecture Notes",
				content: `${"section body\n".repeat(10_000)}needle`,
				createdAt: 0,
				modifiedAt: 0,
			},
		];

		const searchIndex = buildSearchIndex(notes);
		expect(searchIndex[0].normalizedContent).toBeNull();

		const titleResults = filterIndexedNotes(searchIndex, "architecture");
		expect(titleResults).toHaveLength(1);
		expect(searchIndex[0].normalizedContent).toBeNull();

		const contentResults = filterIndexedNotes(searchIndex, "needle");
		expect(contentResults).toHaveLength(1);
		expect(searchIndex[0].normalizedContent).toContain("needle");
		expect(contentResults[0].snippet).toBe("needle");
	});
});
