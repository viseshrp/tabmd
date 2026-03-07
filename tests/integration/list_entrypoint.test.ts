// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";
import { flushMicrotasks } from "../helpers/flush";
import {
	STORAGE_KEYS,
	type NoteRecord,
} from "../../entrypoints/shared/storage";

function makeNote(
	id: string,
	content: string,
	title: string | null,
	modifiedAt: number,
): NoteRecord {
	return {
		id,
		content,
		title,
		createdAt: modifiedAt - 100,
		modifiedAt,
	};
}

describe("list entrypoint", () => {
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

	it("renders notes, filters search, opens notes, renames, and deletes", async () => {
		const alpha = makeNote("alpha", "First body", "Alpha", 100);
		const beta = makeNote("beta", "Contains keyword here", null, 200);
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {
					[alpha.id]: alpha,
					[beta.id]: beta,
				},
				[STORAGE_KEYS.settings]: { theme: "light" },
			},
		});
		setMockChrome(mock);

		vi.stubGlobal(
			"prompt",
			vi.fn(() => "Renamed note"),
		);
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(document.getElementById("note-count")?.textContent).toBe("2");
		expect(document.querySelectorAll(".note-card")).toHaveLength(2);

		document.querySelector<HTMLElement>(".note-card-content")?.click();
		document
			.getElementById("btn-new-note")
			?.dispatchEvent(new MouseEvent("click"));
		document
			.getElementById("btn-options")
			?.dispatchEvent(new MouseEvent("click"));

		expect(mock.__createdTabs.map((entry) => entry.url)).toEqual([
			"chrome-extension://mock/newtab.html#beta",
			"chrome-extension://mock/newtab.html",
			"chrome-extension://mock/options.html",
		]);

		const searchInput = document.getElementById(
			"search-input",
		) as HTMLInputElement;
		searchInput.value = "keyword";
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(document.querySelectorAll(".note-card")).toHaveLength(1);
		expect(document.querySelector(".note-title")?.textContent).toContain(
			"Contains keyword here",
		);

		document.querySelector<HTMLButtonElement>(".action-btn")?.click();
		await flushMicrotasks();
		const storedAfterRename = mock.__storageData[STORAGE_KEYS.notes] as Record<
			string,
			NoteRecord
		>;
		expect(storedAfterRename.beta?.title).toBe("Renamed note");

		searchInput.value = "";
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));
		const deleteButtons =
			document.querySelectorAll<HTMLButtonElement>(".delete-btn");
		deleteButtons[1]?.click();
		await flushMicrotasks();

		const storedAfterDelete = mock.__storageData[STORAGE_KEYS.notes] as Record<
			string,
			NoteRecord
		>;
		expect(storedAfterDelete.alpha).toBeUndefined();
		expect(document.getElementById("snackbar")?.textContent).toContain(
			"Note deleted",
		);
	});

	it("shows the no-results state when search misses", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {
					alpha: makeNote("alpha", "hello world", "Alpha", 100),
				},
			},
		});
		setMockChrome(mock);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		const searchInput = document.getElementById(
			"search-input",
		) as HTMLInputElement;
		searchInput.value = "zebra";
		searchInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(document.getElementById("no-results")?.hidden).toBe(false);
		expect(document.getElementById("notes-grid")?.hidden).toBe(true);
	});

	it("shows the empty state and handles cancel paths", async () => {
		const emptyMock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {},
			},
		});
		setMockChrome(emptyMock);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		expect(document.getElementById("empty-state")?.hidden).toBe(false);
	});

	it("shows snackbar errors when rename or delete persistence fails", async () => {
		const alpha = makeNote("alpha", "Body", "Alpha", 100);
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {
					[alpha.id]: alpha,
				},
			},
		});
		const originalSet = mock.storage.local.set;
		mock.storage.local.set = async (payload) => {
			if (STORAGE_KEYS.notes in payload) {
				throw new Error("persist failed");
			}
			await originalSet(payload);
		};
		setMockChrome(mock);
		vi.stubGlobal(
			"prompt",
			vi.fn(() => "Renamed"),
		);
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		document.querySelector<HTMLButtonElement>(".action-btn")?.click();
		await flushMicrotasks();
		expect(document.getElementById("snackbar")?.textContent).toContain(
			"Failed to rename note",
		);

		document.querySelector<HTMLButtonElement>(".delete-btn")?.click();
		await flushMicrotasks();
		expect(document.getElementById("snackbar")?.textContent).toContain(
			"Failed to delete note",
		);
	});

	it("shows a load error snackbar when notes cannot be read", async () => {
		const mock = createMockChrome();
		mock.storage.local.get = async (keys) => {
			if (keys && typeof keys === "object" && STORAGE_KEYS.notes in keys) {
				throw new Error("read failed");
			}
			return {};
		};
		setMockChrome(mock);

		await import("../../entrypoints/list/index");
		await flushMicrotasks();

		expect(document.getElementById("snackbar")?.textContent).toContain(
			"Error loading notes",
		);
	});
});
