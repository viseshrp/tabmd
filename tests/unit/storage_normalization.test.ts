import { describe, expect, it } from "vitest";
import {
	normalizeNoteRecord,
	normalizeNotesRecord,
} from "../../entrypoints/shared/storage";

describe("storage normalization helpers", () => {
	it("normalizes one note record using the map key as the canonical id", () => {
		expect(
			normalizeNoteRecord("note-1", {
				id: "ignored-id",
				content: 42,
				title: "Saved title",
				createdAt: 50.9,
				modifiedAt: 40.1,
			}),
		).toEqual({
			id: "note-1",
			content: "",
			title: "Saved title",
			createdAt: 50,
			modifiedAt: 50,
		});
	});

	it("drops malformed note entries while preserving valid records", () => {
		expect(
			normalizeNotesRecord({
				"note-1": {
					id: "note-1",
					content: "Hello",
					title: null,
					createdAt: 10,
					modifiedAt: 15,
				},
				"note-2": null,
				"note-3": [],
			}),
		).toEqual({
			"note-1": {
				id: "note-1",
				content: "Hello",
				title: null,
				createdAt: 10,
				modifiedAt: 15,
			},
		});
	});
});
