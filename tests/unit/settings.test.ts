import { beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	STORAGE_KEYS,
	normalizeNoteRecord,
	normalizeNotesRecord,
	normalizeSettings,
	readSettings,
	writeSettings,
} from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

describe("storage helpers", () => {
	beforeEach(() => {
		setMockChrome(createMockChrome());
	});

	it("falls back to defaults for invalid values", () => {
		expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
	});

	it("preserves valid settings", () => {
		expect(
			normalizeSettings({
				theme: "dark",
			}),
		).toEqual({
			theme: "dark",
		});
	});

	it("drops unknown keys and sets default for invalid valid keys", () => {
		expect(
			normalizeSettings({
				theme: "unknown",
				somethingElse: true,
			}),
		).toEqual({
			theme: "os",
		});
	});

	it("normalizes note records and clamps modifiedAt to createdAt", () => {
		expect(
			normalizeNoteRecord("note-1", {
				content: 42,
				title: false,
				createdAt: 12.9,
				modifiedAt: 5,
			}),
		).toEqual({
			id: "note-1",
			content: "",
			title: null,
			createdAt: 12,
			modifiedAt: 12,
		});
	});

	it("rejects malformed note records and filters them from dictionaries", () => {
		expect(normalizeNoteRecord("", { content: "x" })).toBeNull();
		expect(normalizeNoteRecord("note-1", ["not", "an", "object"])).toBeNull();
		expect(
			normalizeNotesRecord({
				keep: { content: "saved", title: "Title", createdAt: 1, modifiedAt: 2 },
				drop: null,
			}),
		).toEqual({
			keep: {
				id: "keep",
				content: "saved",
				title: "Title",
				createdAt: 1,
				modifiedAt: 2,
			},
		});
		expect(normalizeNotesRecord([])).toEqual({});
	});

	it("reads stored settings with defaults when nothing has been saved yet", async () => {
		await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS);
	});

	it("writes settings back to chrome storage", async () => {
		const mockChrome = createMockChrome();
		setMockChrome(mockChrome);

		await writeSettings({ theme: "light" });

		expect(mockChrome.__storageData[STORAGE_KEYS.settings]).toEqual({
			theme: "light",
		});
	});
});
