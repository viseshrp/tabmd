// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";
import { flushMicrotasks } from "../helpers/flush";
import {
	STORAGE_KEYS,
	type NoteRecord,
} from "../../entrypoints/shared/storage";

/**
 * Builds one large note body that still has deterministic search targets near
 * the tail of the document. The UI test exercises the list page end to end
 * without needing timers or implementation-specific hooks.
 */
function createLargeNote(
	id: string,
	title: string,
	trailingNeedle: string,
	modifiedAt: number,
): NoteRecord {
	const largeContent = [
		"# Large note heading",
		"",
		...Array.from(
			{ length: 6_000 },
			(_, index) => `section-${index}: reusable body content`,
		),
		"",
		trailingNeedle,
	].join("\n");

	return {
		id,
		title,
		content: largeContent,
		createdAt: modifiedAt - 100,
		modifiedAt,
	};
}

describe("list entrypoint with large notes", () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = `
      <span id="note-count"></span>
      <input id="search-input" />
      <button id="btn-new-note"></button>
      <button id="btn-options"></button>
      <div id="notes-grid"></div>
      <div id="empty-state" hidden></div>
      <div id="no-results" hidden></div>
      <div id="snackbar"></div>
    `;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders and filters a large note through the list UI", async () => {
		const largeNote = createLargeNote(
			"large-note",
			"Architecture Notebook",
			"needle section for content search",
			500,
		);
		const smallerNote = createLargeNote(
			"other-note",
			"Changelog",
			"completely different tail marker",
			300,
		);
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {
					[largeNote.id]: largeNote,
					[smallerNote.id]: smallerNote,
				},
			},
		});
		setMockChrome(mock);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		expect(document.getElementById("note-count")?.textContent).toBe("2");
		expect(document.querySelectorAll(".note-card")).toHaveLength(2);

		const searchInput = document.getElementById(
			"search-input",
		) as HTMLInputElement;

		// Title-only search should still render the large note through the real list-page DOM flow.
		searchInput.value = "architecture";
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(document.querySelectorAll(".note-card")).toHaveLength(1);
		expect(document.querySelector(".note-title")?.textContent).toBe(
			"Architecture Notebook",
		);

		// A content match near the end of the large body proves the UI can search the full note and show the right snippet.
		searchInput.value = "needle section";
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(document.querySelectorAll(".note-card")).toHaveLength(1);
		expect(document.querySelector(".note-snippet")?.textContent).toBe(
			"needle section for content search",
		);
		expect(document.getElementById("no-results")?.hidden).toBe(true);
	});
});
