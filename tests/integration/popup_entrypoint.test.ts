// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";
import { flushMicrotasks } from "../helpers/flush";
import {
	STORAGE_KEYS,
	type NoteRecord,
} from "../../entrypoints/shared/storage";

function makeNote(id: string, modifiedAt: number): NoteRecord {
	return {
		id,
		content: `# Note ${id}\nBody`,
		title: null,
		createdAt: modifiedAt - 100,
		modifiedAt,
	};
}

describe("popup entrypoint", () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = `
      <ul id="note-list"></ul>
      <div id="empty-state" hidden></div>
      <button id="btn-more"></button>
      <button id="btn-options"></button>
    `;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders the 20 most recent notes and opens navigation targets", async () => {
		const notes = Object.fromEntries(
			Array.from({ length: 25 }, (_, index) => {
				const note = makeNote(`${index + 1}`, 1000 + index);
				return [note.id, note];
			}),
		);
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: notes,
				[STORAGE_KEYS.settings]: { theme: "dark" },
			},
		});
		setMockChrome(mock);

		await import("../../entrypoints/popup/index");
		await flushMicrotasks();

		const items = document.querySelectorAll<HTMLLIElement>(".note-item");
		expect(items).toHaveLength(20);
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(items[0]?.textContent).toContain("Note 25");

		document.querySelector<HTMLAnchorElement>(".note-link")?.click();
		document.getElementById("btn-more")?.dispatchEvent(new MouseEvent("click"));
		document
			.getElementById("btn-options")
			?.dispatchEvent(new MouseEvent("click"));

		expect(mock.__createdTabs.map((entry) => entry.url)).toEqual([
			"chrome-extension://mock/newtab.html#25",
			// The built extension exposes the list page at the root as `list.html`.
			"chrome-extension://mock/list.html",
			"chrome-extension://mock/options.html",
		]);
	});

	it("shows the empty state when there are no notes", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {},
			},
		});
		setMockChrome(mock);

		await import("../../entrypoints/popup/index");
		await flushMicrotasks();

		expect(document.getElementById("empty-state")?.hidden).toBe(false);
		expect(document.getElementById("note-list")?.hidden).toBe(true);
	});

	it("shows an error state when notes fail to load", async () => {
		const mock = createMockChrome();
		mock.storage.local.get = async (keys) => {
			if (keys && typeof keys === "object" && STORAGE_KEYS.notes in keys) {
				throw new Error("load failed");
			}
			return {};
		};
		setMockChrome(mock);

		await import("../../entrypoints/popup/index");
		await flushMicrotasks();

		expect(document.getElementById("empty-state")?.textContent).toContain(
			"Error loading notes.",
		);
	});
});
